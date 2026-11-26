# Army Men: Microplastic Warfare

A 3D toy-soldier shooter for phones (landscape), by No End Studios. Plastic army men fight across a living room, a kitchen and a backyard, with jeeps, tanks and planes, ragdoll physics, and a house that keeps getting in the way: the cat, the kid and Dad with the mower.

- `src/` game source (three.js + Rapier physics)
- `npm install && npm run build` builds `dist/index.html`, one self-contained file
- Pushing to `main` deploys to Fly.io (app `ammw`) through `.github/workflows/fly-deploy.yml`, using the `FLY_API_TOKEN` repository secret
