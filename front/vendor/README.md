# React Advanced Odontogram

`react-advanced-odontogram-2.6.0.tgz` is the unmodified library compiled from
https://github.com/ZoliQua/React-Advanced-Odontogram at commit
`215c43a704ded094d6b0e6c76bc84e3570ffe7c6` (version 2.6.0).

The upstream source was used because this release was not available on npm at
integration time. The MIT license and source maps are included in the archive.
Copyright Zoltán Dul. All theme adaptations live in ClinicApp, outside the library.

To reproduce: check out that commit, run `npm ci`, `npm run build:lib`, then
`npm pack --ignore-scripts`. Place the resulting archive in this directory and
run `npm ci` in `front/` to install the locked dependency.
