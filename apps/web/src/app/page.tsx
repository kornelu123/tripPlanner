const itinerary = [
  {
    time: '9:00',
    title: 'Market coffee',
    detail: 'North Loop · 45 min',
    tone: 'coral',
  },
  {
    time: '10:15',
    title: 'Riverside walk',
    detail: 'Stone Arch · 1 hr',
    tone: 'blue',
  },
  {
    time: '12:00',
    title: 'Garden lunch',
    detail: 'Northeast · 1.5 hrs',
    tone: 'green',
  },
];

export default function Home() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Roamly home">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          Roamly
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#inspiration">Inspiration</a>
          <button className="nav-button" type="button">
            Plan a trip
          </button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Your day, thoughtfully mapped</p>
          <h1>
            Turn a free day into a <em>great story.</em>
          </h1>
          <p className="lede">
            Tell us what you love. We’ll shape a route with local stops,
            breathing room, and none of the spreadsheet stress.
          </p>
          <button className="primary-button" type="button">
            Start planning <span aria-hidden="true">→</span>
          </button>
          <p className="reassurance">Free to plan · No account needed</p>
        </div>

        <div className="preview-wrap" aria-label="Example day plan">
          <div className="sun" aria-hidden="true" />
          <div className="preview-card">
            <div className="preview-header">
              <div>
                <p>Saturday, May 24</p>
                <h2>A slow day in Minneapolis</h2>
              </div>
              <span className="weather">72° ☀</span>
            </div>
            <div className="route-line" aria-hidden="true" />
            <ol className="itinerary">
              {itinerary.map((stop) => (
                <li key={stop.time}>
                  <span className={`pin ${stop.tone}`} aria-hidden="true" />
                  <time>{stop.time}</time>
                  <div>
                    <strong>{stop.title}</strong>
                    <span>{stop.detail}</span>
                  </div>
                  <span aria-hidden="true">↗</span>
                </li>
              ))}
            </ol>
            <div className="trip-summary">
              <span>3 stops</span>
              <span>4.2 miles</span>
              <span>Mostly outdoors</span>
            </div>
          </div>
          <div className="leaf leaf-one" aria-hidden="true" />
          <div className="leaf leaf-two" aria-hidden="true" />
        </div>
      </section>

      <section className="steps" id="how-it-works">
        <p className="eyebrow">Less planning, more wandering</p>
        <div className="step-grid">
          <article>
            <span>01</span>
            <h2>Share your mood</h2>
            <p>Pick a pace, a few interests, and how far you want to roam.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Get a balanced route</h2>
            <p>We connect local favorites into a day that flows naturally.</p>
          </article>
          <article id="inspiration">
            <span>03</span>
            <h2>Make it yours</h2>
            <p>Swap any stop, save the plan, and head out when you’re ready.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
