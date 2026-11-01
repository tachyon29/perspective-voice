import { Link } from "react-router-dom";
import AccountStatus from "../components/AccountStatus";

function SoftwareEngineering() {
  return (
    <main className="career-page">
      <header className="career-page-header">
        <Link to="/" className="career-page-brand">perspective</Link>
        <AccountStatus />
      </header>
      <section className="career-hero">
        <p className="eyebrow">SOFTWARE ENGINEERING</p>

        <h1>Experience the work.</h1>

        <p className="career-description">
          Step into a software engineering team. Build features, debug
          systems, collaborate with teammates, and experience the work
          engineers actually do.
        </p>
      </section>

      <section className="start-section">
        <p className="eyebrow">GET STARTED</p>

        <h2>How would you like to begin?</h2>

        <div className="path-grid">
          <article className="path-card">
            <span className="path-number">01</span>

            <div className="path-content">
              <h3>I'm new to coding</h3>

              <p>
                Learn the fundamentals through hands-on challenges before
                entering your first engineering team.
              </p>

              <Link to="/careers/software-engineering/onboarding">
                Start onboarding →
              </Link>
            </div>
          </article>

          <article className="path-card">
            <span className="path-number">02</span>

            <div className="path-content">
              <h3>I already know how to code</h3>

              <p>
                Skip the basics and jump directly into a simulated software
                engineering workplace.
              </p>

              <Link to="/careers/software-engineering/work">
                Enter the workplace →
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

export default SoftwareEngineering;
