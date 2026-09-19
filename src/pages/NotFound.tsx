import { href } from "../router";

export function NotFound() {
  return (
    <div className="wrap narrow">
      <header>
        <p className="eyebrow">404</p>
        <h1>That page isn't here</h1>
        <p className="dek">The link may be out of date. <a href={href("/")}>Go back to the hub</a>.</p>
      </header>
    </div>
  );
}
