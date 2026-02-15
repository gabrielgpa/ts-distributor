# ts-distributor

React + TypeScript + Vite app with an optional Express backend to generate a weekly hours distribution from cost center and project percentages.

## Requirements
- Node.js 20.19+ (Vite warns on earlier versions)
- npm

## Install
```bash
npm install
```

## Development
Run frontend (Vite) and backend (Express) in parallel:
```bash
npm run dev
```
- Frontend: http://localhost:5173
- API: http://localhost:4000/api/distribute

Standalone scripts:
- `npm run client` – Vite dev server only
- `npm run server` – API only (using `tsx`)

## Tests
```bash
npm test
```
(Vitest unit tests covering core distribution rules.)

## Build
```bash
npm run build
```
Output in `dist/`.

## Deploy to AWS S3
The project includes `scripts/deploy-s3.sh` for build + deploy.

Create `.env` in the project root:
```bash
S3_BUCKET="<bucket-name>"
CLOUDFRONT_DISTRIBUTION_ID="<distribution-id>"
AWS_PROFILE="<profile-name>"
```

Then run:
```bash
npm run deploy:s3
```

You can still override values per command:
```bash
S3_BUCKET=my-bucket-name AWS_REGION=us-east-1 npm run deploy:s3
```
Override default AWS profile when needed:
```bash
S3_BUCKET=my-bucket-name AWS_PROFILE=another-profile npm run deploy:s3
```

Skip build and deploy existing `dist/`:
```bash
npm run deploy:s3:skip-build -- my-bucket-name
```

Optional CloudFront invalidation after upload:
```bash
S3_BUCKET=my-bucket-name CLOUDFRONT_DISTRIBUTION_ID=E123ABC456 npm run deploy:s3
```

## API
`POST /api/distribute`
```json
{
  "centers": [
    {
      "id": "cc1",
      "label": "Center 1",
      "percentage": 50,
      "projects": [
        {
          "id": "cc1_p1",
          "label": "Project 1",
          "percentage": 60,
          "dayPercentages": { "mon": 50, "tue": 30, "wed": 20, "thu": 0, "fri": 0 }
        },
        { "id": "cc1_p2", "label": "Project 2", "percentage": 40 }
      ]
    }
  ],
  "week": {
    "totalHours": 35,
    "workingDays": ["mon", "tue", "wed", "thu", "fri"],
    "roundingStep": 0.25,
    "minChunk": 0.5,
    "maxProjectsPerDay": 3,
    "cooldown": 1
  }
}
```
Response:
- `weeklyTotals`: weekly hours per project
- `dailySchedule`: daily distribution (day, entries, total)
- `diagnostics`: normalization and drift

Notes:
- `dayPercentages` is optional per project and acts as a day-of-week preference profile.
- If omitted or all zeros, the project uses a uniform profile across working days.

## Defaults and sample data
- Default centers: three centers with two projects each.
- Default week: 35h, Mon–Fri (`mon`–`fri` codes), rounding step 0.25h, min chunk 0.5h, max 3 projects/day.

## Implementation notes
- No database; state is stored in memory and localStorage.
- The algorithm lives in `src/distribution/algorithm.ts` and is shared by frontend and backend.
- The UI can export CSV or plain text to the clipboard.
