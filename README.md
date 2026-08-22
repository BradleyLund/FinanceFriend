# Finance Friend

A small, growing set of static financial visualizers, hosted on GitHub Pages.
No build step, no backend — plain HTML/CSS/JS plus [Chart.js](https://www.chartjs.org/) via CDN.

## Tools

- **[Invest vs. Debt](InvestVsDebt/index.html)** — split a monthly payment
  between paying down a loan and investing; see projected net worth over
  time and the month debt hits zero.
- **Rent vs. Buy** — not started yet (`RentVsBuy/`).

## Structure

```
index.html            landing page (ledger of tools)
assets/css/shared.css design tokens + shared components
InvestVsDebt/          debt payoff vs. investing visualizer
RentVsBuy/              placeholder
```

## Local development

No build step — just serve the folder statically, e.g.:

```
python -m http.server 8000
```

then open `http://localhost:8000/`.

## Deploying

GitHub Pages should be set to deploy from the `main` branch, root folder
(Settings → Pages → Build and deployment → Source: Deploy from a branch →
`main` / `/root`).
