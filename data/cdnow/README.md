# CDNOW sample

Transaction-level sample of 2,357 CDNOW customers (Jan 1997 – Jun 1998), the dataset used in
Fader, Hardie & Lee (2005), "Counting Your Customers the Easy Way: An Alternative to the
Pareto/NBD Model", *Marketing Science* 24(2). Copied from the `lifetimes` Python library
(MIT licence): https://github.com/CamDavidsonPilon/lifetimes

Columns: customer id, sample id, date (YYYYMMDD), number of CDs, amount (USD).
Used by `scripts/validate-cdnow.ts` to check our BG/NBD implementation against the published parameters.
