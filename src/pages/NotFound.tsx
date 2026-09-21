import { href } from "../router";

export function NotFound() {
  return (
    <div className="page">
      <header className="page-hero center">
        <p className="eyebrow">404</p>
        <h1>That page isn't here.</h1>
        <p className="lede">The link may be out of date. <a href={href("/")}>Go back to the start</a>.</p>
      </header>
    </div>
  );
}
