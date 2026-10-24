import { SAMPLE_NOTICE as n } from "@/lib/ai";
import s from "./notice.module.css";

const R = (v: number) => "₹" + v.toLocaleString("en-IN");

export default function SampleNotice() {
  return (
    <main className={s.bg}>
      <article className={s.paper} id="notice">
        <div className={s.stamp}>SAMPLE · FOR DEMONSTRATION ONLY · NOT AN OFFICIAL DOCUMENT</div>
        <header className={s.head}>
          <p className="kn">ವಾಣಿಜ್ಯ ತೆರಿಗೆಗಳ ಇಲಾಖೆ</p>
          <p>Office of the {n.issuedBy}</p>
          <p className={s.small}>FORM GST ASMT-10 · Notice for intimating discrepancies</p>
        </header>
        <div className={s.meta}>
          <span>Ref: {n.reference}</span>
          <span>Date: {n.dateIssued}</span>
        </div>
        <p>To,<br />{n.taxpayerName}<br />No. 14, 27th Main, HSR Layout Sector 2, Bengaluru 560102</p>
        <p><b>Subject:</b> Unregistered supply — {n.period}</p>
        <p className="kn">ನಿಮ್ಮ UPI ಸ್ವೀಕೃತಿಗಳು ನೋಂದಣಿ ಮಿತಿಯನ್ನು ಮೀರಿವೆ. ಕೆಳಗಿನ ತೆರಿಗೆಯನ್ನು ಪಾವತಿಸಿ ಅಥವಾ ವಿವರಣೆ ನೀಡಿ.</p>
        <p>{n.basis} You are hereby required to pay the amounts below or furnish an explanation with documentary evidence on or before <b>{n.replyBy}</b>.</p>
        <table className={s.table}>
          <tbody>
            <tr><td>Turnover as per UPI data</td><td>{R(n.turnoverAlleged)}</td></tr>
            <tr><td>Tax (CGST + KGST)</td><td>{R(n.tax)}</td></tr>
            <tr><td>Interest u/s 50</td><td>{R(n.interest)}</td></tr>
            <tr><td>Penalty</td><td>{R(n.penalty)}</td></tr>
            <tr className={s.total}><td>Total demand</td><td>{R(n.total)}</td></tr>
          </tbody>
        </table>
        <p className={s.small}>Failing which, proceedings under Section 73 shall be initiated without further notice.</p>
        <footer className={s.sign}>
          <span>Sd/-</span>
          <span>Assistant Commissioner, DVO-14</span>
        </footer>
      </article>
    </main>
  );
}
