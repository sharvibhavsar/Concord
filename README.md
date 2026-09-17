1) Install dependencies.
2) Copy path of folder.
3) Open terminal and direct to folder.
4) set PORT=5001
   set BASE_PATH=/
   npx pnpm --filter "@workspace/api-server" run dev
5) Open a new terminal and keep api-server running and direct to folder.
6) set PORT=5000
   set BASE_PATH=/
   npx pnpm --filter "@workspace/concord" run dev
7) Open localhost project.
