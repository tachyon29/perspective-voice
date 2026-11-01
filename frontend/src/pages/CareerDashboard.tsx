import { Link } from "react-router-dom";
import AccountStatus from "../components/AccountStatus";
import { useProgress } from "../progress/ProgressProvider";
import { getReflectionMetrics, REFLECTION_METRICS } from "../utils/careerReflection";

const ONBOARDING_MISSION_COUNT = 10;

function CareerDashboard() {
  const { progress } = useProgress();
  const reflection = progress.reflection;
  const onboarding = progress.onboarding;
  const workplace = progress.workplace;
  const consulting = progress.managementConsulting;
  const consultingReflection = progress.managementConsultingReflection;
  const completedMissions = Math.min(
    onboarding?.completedMissions.length ?? 0,
    ONBOARDING_MISSION_COUNT,
  );
  const missionPercent = (completedMissions / ONBOARDING_MISSION_COUNT) * 100;
  const resumePath = consulting
    ? "/careers/management-consulting/work"
    : progress.journeyStage === "workplace"
      ? "/careers/software-engineering/work"
      : progress.journeyStage === "onboarding"
        ? "/careers/software-engineering/onboarding"
        : "/careers/software-engineering";
  const workplaceStatus =
    workplace?.pullRequestStatus === "merged"
      ? "PAY-142 merged"
      : workplace?.pullRequestStatus === "in-review"
        ? "PAY-142 in review"
        : workplace?.checksPassed
          ? "Checks passing"
          : progress.journeyStage === "workplace"
            ? "In progress"
            : "Not started";

  const average = reflection
    ? Object.values(reflection.metrics).reduce((total, value) => total + value, 0) /
      REFLECTION_METRICS.length
    : null;
  const consultingMetrics = getReflectionMetrics("Management Consulting");
  const consultingAverage = consultingReflection
    ? Object.values(consultingReflection.metrics).reduce((total, value) => total + value, 0) /
      consultingMetrics.length
    : null;

  return (
    <main className="career-dashboard">
      <header className="dashboard-header">
        <Link to="/" className="dashboard-brand">perspective</Link>
        <span>YOUR CAREER DASHBOARD</span>
        <Link className="dashboard-back-link" to={resumePath}>Resume journey</Link>
        <AccountStatus />
      </header>

      <div className="dashboard-content">
        <div className="dashboard-intro">
          <p className="eyebrow">YOUR EXPERIENCE SO FAR</p>
          <h1>Your career experiences</h1>
          <p>
            See where you left off and what you learned from experiencing the work.
          </p>
        </div>

        <section className="journey-summary-card" aria-labelledby="journey-summary-title">
          <div className="journey-summary-heading">
            <div>
              <p className="eyebrow">YOUR JOURNEY</p>
              <h2 id="journey-summary-title">Progress so far</h2>
            </div>
            <Link to={resumePath}>Continue →</Link>
          </div>

          <div className="journey-progress-item">
            <div className="journey-progress-copy">
              <span>Coding onboarding</span>
              <strong>
                {onboarding
                  ? `${completedMissions} of ${ONBOARDING_MISSION_COUNT} missions complete`
                  : "Not started"}
              </strong>
            </div>
            <div
              className="journey-progress-track"
              role="progressbar"
              aria-label="Coding onboarding progress"
              aria-valuemin={0}
              aria-valuemax={ONBOARDING_MISSION_COUNT}
              aria-valuenow={completedMissions}
            >
              <div style={{ width: `${missionPercent}%` }} />
            </div>
          </div>

          <div className="journey-progress-item journey-workplace-status">
            <div className="journey-progress-copy">
              <span>NovaPay · PAY-142</span>
              <strong>{workplaceStatus}</strong>
            </div>
            <Link to="/careers/software-engineering/work">Open workplace →</Link>
          </div>

          <div className="journey-progress-item journey-workplace-status">
            <div className="journey-progress-copy">
              <span>Northstar · FreshMarket case</span>
              <strong>{consultingReflection ? "Case complete · Reflection saved" : consulting ? "Case in progress" : "Not started"}</strong>
            </div>
            <Link to={consulting ? "/careers/management-consulting/work" : "/careers/management-consulting"}>{consulting ? "Resume case →" : "Explore consulting →"}</Link>
          </div>
        </section>

        {reflection ? (
          <>
            <section className="career-summary-card">
              <div className="career-summary-heading">
                <div>
                  <p className="eyebrow">CAREER REFLECTION</p>
                  <h2>{reflection.careerName}</h2>
                </div>
                <span>WORKPLACE TASK · PAY-142</span>
              </div>
              <div className="career-summary-stats">
                <article>
                  <span>Average experience rating</span>
                  <strong>{average?.toFixed(1)} <small>/ 5</small></strong>
                </article>
                <article>
                  <span>Likelihood you’d choose this career</span>
                  <strong>{reflection.careerLikelihood} <small>/ 10</small></strong>
                </article>
              </div>
              {reflection.savedAt && (
                <p className="reflection-saved-date">
                  Saved {new Date(reflection.savedAt).toLocaleDateString()}
                </p>
              )}
            </section>

            <section className="dashboard-metrics">
              <div className="dashboard-section-heading">
                <h2>What the work felt like</h2>
                <span>Rated from 1 to 5</span>
              </div>
              {REFLECTION_METRICS.map((metric) => {
                const value = reflection.metrics[metric.key];
                return (
                  <article className="dashboard-metric" key={metric.key}>
                    <div className="dashboard-metric-label">
                      <span>{metric.label}</span>
                      <strong>{value} / 5</strong>
                    </div>
                    <div className="dashboard-metric-track">
                      <div style={{ width: `${(value / 5) * 100}%` }} />
                    </div>
                  </article>
                );
              })}
            </section>

            {reflection.note && (
              <section className="dashboard-note">
                <p className="eyebrow">NOTE TO YOURSELF</p>
                <p>{reflection.note}</p>
              </section>
            )}
          </>
        ) : !consulting && !consultingReflection ? (
          <section className="dashboard-reflection-empty">
            <p className="eyebrow">CAREER REFLECTION</p>
            <h2>Your reflection will appear here</h2>
            <p>
              Finish the workplace task and save your ratings to see your experience
              metrics and notes here.
            </p>
            <Link to="/careers/software-engineering/work">Continue the workplace task →</Link>
          </section>
        ) : null}

        {consultingReflection ? (
          <>
            <section className="career-summary-card">
              <div className="career-summary-heading">
                <div>
                  <p className="eyebrow">CAREER REFLECTION</p>
                  <h2>{consultingReflection.careerName}</h2>
                </div>
                <span>CLIENT CASE · FRESHMARKET</span>
              </div>
              <div className="career-summary-stats">
                <article>
                  <span>Average experience rating</span>
                  <strong>{consultingAverage?.toFixed(1)} <small>/ 5</small></strong>
                </article>
                <article>
                  <span>Likelihood you’d choose this career</span>
                  <strong>{consultingReflection.careerLikelihood} <small>/ 10</small></strong>
                </article>
              </div>
              {consultingReflection.savedAt && <p className="reflection-saved-date">Saved {new Date(consultingReflection.savedAt).toLocaleDateString()}</p>}
            </section>
            <section className="dashboard-metrics">
              <div className="dashboard-section-heading"><h2>What the consulting work felt like</h2><span>Rated from 1 to 5</span></div>
              {consultingMetrics.map((metric) => {
                const value = consultingReflection.metrics[metric.key];
                return <article className="dashboard-metric" key={metric.key}><div className="dashboard-metric-label"><span>{metric.label}</span><strong>{value} / 5</strong></div><div className="dashboard-metric-track"><div style={{ width: `${(value / 5) * 100}%` }} /></div></article>;
              })}
            </section>
            {consultingReflection.note && <section className="dashboard-note"><p className="eyebrow">NOTE TO YOURSELF</p><p>{consultingReflection.note}</p></section>}
          </>
        ) : consulting ? (
          <section className="dashboard-reflection-empty">
            <p className="eyebrow">MANAGEMENT CONSULTING</p>
            <h2>Your case is in progress</h2>
            <p>Continue the FreshMarket case and save a reflection to add your consulting experience here.</p>
            <Link to="/careers/management-consulting/work">Continue the case →</Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default CareerDashboard;
