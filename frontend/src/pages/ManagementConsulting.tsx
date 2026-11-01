import { ArrowRight, BarChart3, BriefcaseBusiness, FileSpreadsheet, MessageSquareText, Presentation } from "lucide-react";
import { Link } from "react-router-dom";
import AccountStatus from "../components/AccountStatus";
import { useProgress } from "../progress/ProgressProvider";

const steps = ["Meet the team", "Investigate the case", "Build a recommendation"];

function ManagementConsulting() {
  const { progress } = useProgress();
  const saved = progress.managementConsulting;
  const trackStarted = saved !== null;

  return (
    <main className="career-page consulting-career-page">
      <header className="career-page-header">
        <Link to="/" className="career-page-brand">perspective</Link>
        <AccountStatus />
      </header>

      <section className="career-hero consulting-career-hero">
        <p className="eyebrow">MANAGEMENT CONSULTING · NORTHSTAR ADVISORY</p>
        <h1>Help a client make sense of a difficult decision.</h1>
        <p className="career-description">
          Join a small case team, investigate why a grocery chain’s profits are
          falling, and present a recommendation backed by evidence.
        </p>
        <div className="consulting-career-actions">
          <Link className="consulting-primary-link" to="/careers/management-consulting/work">
            {trackStarted ? "Resume your case" : "Join the case team"}<ArrowRight size={15} />
          </Link>
          <span>About 25–35 minutes · No business background required</span>
        </div>
      </section>

      <section className="consulting-preview" aria-label="What you will do">
        <div className="consulting-preview-heading">
          <p className="eyebrow">YOUR FIRST CLIENT CASE</p>
          <h2>From an unclear problem to a clear recommendation.</h2>
          <p>
            Work through the same kinds of steps a junior consultant might own:
            gather facts, test an explanation, align with the team, and make the
            next move clear to a client.
          </p>
        </div>
        <div className="consulting-preview-steps">
          {steps.map((step, index) => (
            <article key={step}>
              <span>0{index + 1}</span>
              <strong>{step}</strong>
              <p>{[
                "Meet your case team and hear the client’s question.",
                "Explore store data and see which explanation the evidence supports.",
                "Choose a practical pilot, build a short readout, and hear the client’s response.",
              ][index]}</p>
            </article>
          ))}
        </div>
        <div className="consulting-tool-strip">
          <span><BriefcaseBusiness size={15} /> Client brief</span>
          <span><FileSpreadsheet size={15} /> Working spreadsheet</span>
          <span><MessageSquareText size={15} /> Case team chat</span>
          <span><Presentation size={15} /> Recommendation readout</span>
          <span className="consulting-tool-note"><BarChart3 size={15} /> Everything you need is inside Perspective</span>
        </div>
      </section>
    </main>
  );
}

export default ManagementConsulting;
