import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";

const port = Number(process.env.ORDERING_API_PORT || 4317);
const token = process.env.ORDERING_API_TOKEN;
const connectionString = process.env.ORDERING_DATABASE_URL;
if (!token || token.length < 32 || !connectionString) {
  throw new Error("Set ORDERING_API_TOKEN (32+ characters) and ORDERING_DATABASE_URL before starting.");
}
const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
const json = (res, status, data) => {res.writeHead(status, {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(data));};
function authorized(req) {
  const supplied = req.headers.authorization?.replace(/^Bearer /i,"") || "";
  const a=Buffer.from(supplied),b=Buffer.from(token);
  return a.length===b.length && timingSafeEqual(a,b);
}
async function body(req) {
  let data="";for await(const part of req){data+=part;if(data.length>1024*1024)throw new Error("Request exceeds 1MB");}
  return JSON.parse(data || "{}");
}
const nonblank=v=>typeof v==="string"&&v.trim().length>0&&v.length<=500;
async function handle(req,res) {
  if(!authorized(req))return json(res,401,{error:"Unauthorized"});
  try{
    if(req.method==="GET"&&req.url==="/health"){
      await pool.query("SELECT 1");return json(res,200,{ok:true});
    }
    if(req.method==="GET"&&req.url==="/products"){
      const {rows}=await pool.query(`SELECT p.msp_item_code,p.description,COALESCE(json_agg(DISTINCT b.barcode) FILTER (WHERE b.barcode IS NOT NULL),'[]') AS barcodes FROM office_ordering.products p LEFT JOIN office_ordering.product_barcodes b ON b.product_id=p.id GROUP BY p.id ORDER BY p.msp_item_code LIMIT 5000`);
      return json(res,200,{products:rows});
    }
    if(req.method==="GET"&&req.url==="/supplier-offers"){
      const {rows}=await pool.query(`SELECT s.name AS supplier,sp.supplier_code,p.msp_item_code,sp.units_per_case,price.net_case_price,price.currency FROM office_ordering.supplier_products sp JOIN office_ordering.suppliers s ON s.id=sp.supplier_id JOIN office_ordering.products p ON p.id=sp.product_id JOIN LATERAL (SELECT pr.net_case_price,pr.currency FROM office_ordering.supplier_prices pr JOIN office_ordering.price_uploads pu ON pu.id=pr.upload_id WHERE pr.supplier_product_id=sp.id AND pu.status='approved' ORDER BY pr.effective_at DESC,pr.id DESC LIMIT 1) price ON true WHERE sp.active AND s.active ORDER BY s.name,p.msp_item_code LIMIT 10000`);
      return json(res,200,{offers:rows});
    }
    if(req.method==="POST"&&req.url==="/product-mappings"){
      const input=await body(req);
      if(!nonblank(input.mspItemCode)||!nonblank(input.description)||!nonblank(input.supplier)||!nonblank(input.supplierCode)||!Array.isArray(input.barcodes)||input.barcodes.length>30||input.barcodes.some(x=>!nonblank(x)))return json(res,400,{error:"Invalid product mapping"});
      const client=await pool.connect();
      try{
        await client.query("BEGIN");
        const product=await client.query(`INSERT INTO office_ordering.products(msp_item_code,description) VALUES($1,$2) ON CONFLICT(msp_item_code) DO UPDATE SET description=EXCLUDED.description RETURNING id`,[input.mspItemCode.trim(),input.description.trim()]);
        const productId=product.rows[0].id;
        const supplier=await client.query("SELECT id FROM office_ordering.suppliers WHERE lower(name)=lower($1) AND active=true",[input.supplier.trim()]);
        if(!supplier.rowCount)throw new Error("Unknown or inactive supplier");
        for(const barcode of new Set(input.barcodes.map(x=>x.trim()))){
          const result=await client.query(`INSERT INTO office_ordering.product_barcodes(product_id,barcode) VALUES($1,$2) ON CONFLICT(barcode) DO UPDATE SET barcode=EXCLUDED.barcode WHERE office_ordering.product_barcodes.product_id=EXCLUDED.product_id RETURNING id`,[productId,barcode]);
          if(!result.rowCount)throw new Error("Barcode belongs to another MSP item");
        }
        const existing=await client.query("SELECT product_id FROM office_ordering.supplier_products WHERE supplier_id=$1 AND supplier_code=$2",[supplier.rows[0].id,input.supplierCode.trim()]);
        if(existing.rowCount&&existing.rows[0].product_id!==null&&String(existing.rows[0].product_id)!==String(productId))throw new Error("Supplier code belongs to another MSP item");
        await client.query(`INSERT INTO office_ordering.supplier_products(supplier_id,supplier_code,product_id) VALUES($1,$2,$3) ON CONFLICT(supplier_id,supplier_code) DO UPDATE SET product_id=EXCLUDED.product_id`,[supplier.rows[0].id,input.supplierCode.trim(),productId]);
        await client.query("COMMIT");return json(res,201,{ok:true,mspItemCode:input.mspItemCode});
      }catch(error){await client.query("ROLLBACK");if(error.code==="23505")return json(res,409,{error:"Identifier already exists"});if(/belongs to another|Unknown/.test(error.message))return json(res,409,{error:error.message});throw error}finally{client.release()}
    }
    if(req.method==="POST"&&req.url==="/price-batches"){
      const input=await body(req);
      if(!nonblank(input.supplier)||!nonblank(input.filename)||!nonblank(input.uploadedBy)||!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>5000)return json(res,400,{error:"Invalid price batch"});
      const client=await pool.connect();
      try{
        await client.query("BEGIN");
        const supplier=await client.query("SELECT id FROM office_ordering.suppliers WHERE lower(name)=lower($1) AND active=true",[input.supplier]);
        if(!supplier.rowCount)throw new Error("Unknown supplier");
        const batch=await client.query(`INSERT INTO office_ordering.price_uploads(supplier_id,filename,uploaded_by,status) VALUES($1,$2,$3,'pending') RETURNING id`,[supplier.rows[0].id,input.filename,input.uploadedBy]);
        const seen=new Set();
        for(const line of input.lines){
          if(!nonblank(line.supplierCode)||seen.has(line.supplierCode)||!Number.isFinite(line.netCasePrice)||line.netCasePrice<0||!Number.isSafeInteger(line.unitsPerCase)||line.unitsPerCase<1)throw new Error("Invalid or duplicate supplier price line");
          seen.add(line.supplierCode);
          const sp=await client.query("SELECT id,product_id FROM office_ordering.supplier_products WHERE supplier_id=$1 AND supplier_code=$2",[supplier.rows[0].id,line.supplierCode]);
          if(!sp.rowCount||!sp.rows[0].product_id)throw new Error("Unmapped supplier code: "+line.supplierCode);
          const sizeCheck=await client.query("SELECT units_per_case FROM office_ordering.supplier_products WHERE id=$1",[sp.rows[0].id]);
          if(Number(sizeCheck.rows[0].units_per_case)!==line.unitsPerCase)throw new Error("Case size differs from verified mapping: "+line.supplierCode);
          await client.query("INSERT INTO office_ordering.supplier_prices(supplier_product_id,upload_id,net_case_price) VALUES($1,$2,$3)",[sp.rows[0].id,batch.rows[0].id,line.netCasePrice]);
        }
        await client.query("COMMIT");return json(res,201,{batchId:batch.rows[0].id,status:"pending"});
      }catch(error){await client.query("ROLLBACK");if(/Unknown|Invalid|Unmapped/.test(error.message))return json(res,400,{error:error.message});throw error}finally{client.release()}
    }
    if(req.method==="GET"&&req.url==="/price-batches"){
      const {rows}=await pool.query(`SELECT pu.id,pu.filename,pu.uploaded_by,pu.uploaded_at,pu.status,s.name AS supplier,COUNT(pr.id)::int AS line_count FROM office_ordering.price_uploads pu JOIN office_ordering.suppliers s ON s.id=pu.supplier_id LEFT JOIN office_ordering.supplier_prices pr ON pr.upload_id=pu.id GROUP BY pu.id,s.name ORDER BY pu.uploaded_at DESC LIMIT 200`);
      return json(res,200,{batches:rows});
    }
    if(req.method==="GET"&&/^\\/price-batches\\/\\d+$/.test(req.url||"")){
      const id=Number(req.url.split("/")[2]);
      const batch=await pool.query(`SELECT pu.id,pu.filename,pu.status,pu.uploaded_by,s.name AS supplier FROM office_ordering.price_uploads pu JOIN office_ordering.suppliers s ON s.id=pu.supplier_id WHERE pu.id=$1`,[id]);
      if(!batch.rowCount)return json(res,404,{error:"Batch not found"});
      const lines=await pool.query(`SELECT sp.supplier_code,p.msp_item_code,pr.net_case_price,sp.units_per_case,pr.currency FROM office_ordering.supplier_prices pr JOIN office_ordering.supplier_products sp ON sp.id=pr.supplier_product_id JOIN office_ordering.products p ON p.id=sp.product_id WHERE pr.upload_id=$1 ORDER BY sp.supplier_code`,[id]);
      return json(res,200,{batch:batch.rows[0],lines:lines.rows});
    }
    if(req.method==="POST"&&/^\\/price-batches\\/\\d+\\/(approve|reject)$/.test(req.url||"")){
      const parts=req.url.split("/"),id=Number(parts[2]),action=parts[3],input=await body(req);
      if(!nonblank(input.reviewedBy)||typeof input.note!=="string"||input.note.length>1000)return json(res,400,{error:"Reviewer and note required"});
      const client=await pool.connect();
      try{
        await client.query("BEGIN");
        const result=await client.query("SELECT status FROM office_ordering.price_uploads WHERE id=$1 FOR UPDATE",[id]);
        if(!result.rowCount){await client.query("ROLLBACK");return json(res,404,{error:"Batch not found"})}
        if(result.rows[0].status!=="pending"){await client.query("ROLLBACK");return json(res,409,{error:"Batch has already been reviewed"})}
        if(action==="approve"){
          const count=await client.query("SELECT COUNT(*)::int AS n FROM office_ordering.supplier_prices WHERE upload_id=$1",[id]);
          if(count.rows[0].n===0){await client.query("ROLLBACK");return json(res,400,{error:"Cannot approve an empty batch"})}
        }
        const status=action==="approve"?"approved":"rejected";
        await client.query("UPDATE office_ordering.price_uploads SET status=$1 WHERE id=$2",[status,id]);
        await client.query("INSERT INTO office_ordering.price_approval_audit(upload_id,old_status,new_status,reviewed_by,note) VALUES($1,'pending',$2,$3,$4)",[id,status,input.reviewedBy.trim(),input.note]);
        await client.query("COMMIT");return json(res,200,{id,status});
      }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
    }
    return json(res,404,{error:"Not found"});
  }catch(error){console.error(randomUUID(),error);return json(res,500,{error:"Internal server error"})}
}
http.createServer((req,res)=>{void handle(req,res)}).listen(port,"127.0.0.1",()=>console.log("Ordering local API listening on 127.0.0.1:"+port));
process.on("SIGTERM",async()=>{await pool.end();process.exit(0)});
