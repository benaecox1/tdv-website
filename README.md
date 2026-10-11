# The Director's Vision website

## Editing the site
Go to **yoursite.com/admin** and log in with GitHub.

- **Pages** has the Home, Services, About and Contact pages, plus the thank-you message.
- **Legal pages** has the Privacy Policy and the Terms.
- **Site settings** has your email, calendar link, social links, address and logos.

To change a photo, click the photo field, then **Choose different image** and upload the new one.
Click **Publish** at the top when you're done. The live site updates in about a minute.

Tip: in any headline, put *stars* around words to make them gold italic.

## How it works (for whoever helps you later)
- Content lives in `/content` as JSON and markdown. Photos live in `/images`.
- `build.js` turns the content into the pages. It needs no packages. Netlify runs `node build.js` and publishes `_site`.
- The dashboard is Decap CMS. Its settings are in `admin/config.yml`.
- The inquiry form uses Netlify Forms (form name: `inquiry`).
