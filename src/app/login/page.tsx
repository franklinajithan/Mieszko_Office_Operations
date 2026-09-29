import { pinLogin } from "./actions";
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const q=await searchParams;
  const message=q.error==="invalid"?"Invalid PIN":q.error?"Unable to sign in. Please try again.":"";
  return <main className="authPage"><form className="authCard" action={pinLogin}><div className="mark">M</div><h1>Staff sign in</h1><p>Enter your 6-digit Mieszko PIN.</p><label>6-digit PIN<input name="pin" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="pinInput" autoFocus required/></label>{message&&<div className="error">{message}</div>}<button className="submit">Sign in</button></form></main>
}