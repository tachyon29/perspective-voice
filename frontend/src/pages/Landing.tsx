import { Link } from "react-router-dom";
import AccountStatus from "../components/AccountStatus";
function Landing() {
  return (
    <main className="landing-page">
      <nav>
        <div>perspective</div>

        <div>
          <a href="#careers">Explore careers</a>
          <a href="#about">About</a>
          <AccountStatus />
        </div>
      </nav>

      <section className="hero-section">
        <p>CAREER SIMULATION PLATFORM</p>

        <h1>
          Powered by AI voice teammates
        </h1>

        <p>
          Step inside realistic work environments, solve real problems,
          collaborate with AI teammates, and discover what a career actually
          feels like.
        </p>

        <button
          onClick={() => document.getElementById("careers")?.scrollIntoView({ behavior: "smooth" })}
        >
          Explore careers
        </button>
      </section>

      <section id="careers">
        <p>EXPLORE</p>

        <h2>Step inside the work.</h2>

        <div>
          <article>
            <p>01</p>
            <h3>Software Engineering</h3>
            <p>
              Debug production systems, build features, work with teammates,
              and experience the engineering workflow.
            </p>
            <Link to="/careers/software-engineering">
            <button>Explore →</button>
            </Link>
          </article>

          <article>
            <p>02</p>
            <h3>Management Consulting</h3>
            <p>
              Investigate a client’s business problem, work with a case team,
              and make an evidence-led recommendation.
            </p>
            <Link to="/careers/management-consulting">
              <button>Explore →</button>
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}

export default Landing;
