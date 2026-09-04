# Changesets

Release notes live here as `*.md` files created with `bunx changeset`.
On `main`, the release workflow opens a "Version Packages" pull request;
`just release-version` does the same bump locally. Publishing happens from a
`vX.Y.Z` tag via npm Trusted Publishing (`docs/release.md`). The three
`@earcon/*` packages are a `fixed` group and always share one version.
