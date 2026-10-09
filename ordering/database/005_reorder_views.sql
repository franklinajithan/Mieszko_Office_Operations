-- Supplier offer comparison: case rounding and delivery terms.
-- This view is read-only and contains only APPROVED prices.
CREATE OR REPLACE VIEW office_ordering.v_supplier_offer_comparison AS
 SELECT
   a.supplier_id,a.supplier,a.supplier_product_id,a.supplier_code,
   a.product_id,a.msp_item_code,a.description,a.units_per_case,
   a.net_case_price,a.currency,a.effective_at,
   ROUND(a.net_case_price / a.units_per_case,4) AS net_unit_price,
   COALESCE(t.minimum_order_net,0) AS minimum_order_net,
   COALESCE(t.delivery_fee_net,0) AS delivery_fee_net,
   t.free_delivery_threshold_net,
   COALESCE(t.lead_time_days,1) AS lead_time_days
 FROM office_ordering.v_approved_supplier_prices a
 LEFT JOIN office_ordering.supplier_terms t ON t.supplier_id=a.supplier_id;

-- One row per store/product, with a computed suggested order quantity.
-- Weekly sales are not added here: they may overlap with daily sales.
-- Only sales_daily is used; missing data yields 0 demand and needs manual review.
CREATE OR REPLACE VIEW office_ordering.v_reorder_candidates AS
 WITH sales AS (
  SELECT store_id,product_id,
   SUM(GREATEST(quantity,0)) AS sold_units_28d,
   COUNT(DISTINCT sale_date) AS days_with_sales_records
  FROM office_ordering.sales_daily
  WHERE sale_date >= CURRENT_DATE - 27 AND sale_date <= CURRENT_DATE
  GROUP BY store_id,product_id
 ),
 received AS (
  SELECT store_id,product_id,SUM(received_quantity) AS units_received_not_posted
  FROM office_ordering.incoming_deliveries
  WHERE status='physically_received'
  GROUP BY store_id,product_id
 )
 SELECT r.store_id,r.product_id,s.store_code,p.msp_item_code,
  COALESCE(b.quantity,0) AS msp_book_stock_units,
  COALESCE(d.units_received_not_posted,0) AS physical_receipts_pending_msp,
  COALESCE(a.sold_units_28d,0) AS sales_units_28d,
  COALESCE(a.days_with_sales_records,0) AS days_with_sales_records,
  COALESCE(a.sold_units_28d / 28.0,0) AS estimated_daily_units,
  r.target_cover_days,r.safety_stock_units,r.minimum_display_units,r.maximum_stock_units,
  GREATEST(0,CEIL(
   GREATEST(
    COALESCE(a.sold_units_28d / 28.0,0)*r.target_cover_days+r.safety_stock_units,
    r.minimum_display_units
   )-COALESCE(b.quantity,0)
   -- Deliberately do NOT automatically add physical receipts; MSP snapshot
   -- timing must be verified first to avoid double counting.
  )) AS preliminary_required_units,
  (b.snapshot_at IS NULL) AS missing_book_stock
 FROM office_ordering.reorder_rules r
 JOIN office_ordering.stores s ON s.id=r.store_id
 JOIN office_ordering.products p ON p.id=r.product_id
 LEFT JOIN office_ordering.book_stock_latest b ON b.store_id=r.store_id AND b.product_id=r.product_id
 LEFT JOIN sales a ON a.store_id=r.store_id AND a.product_id=r.product_id
 LEFT JOIN received d ON d.store_id=r.store_id AND d.product_id=r.product_id
 WHERE r.enabled;
COMMENT ON VIEW office_ordering.v_reorder_candidates IS
 'Advisory only. Requires stock freshness, delivery reconciliation and sales completeness checks before order generation.';
