const express = require("express");

const main = require("./dist/mainSSR");

const app = express();

app.use(express.static("dist"));
app.get("/mysql", (req, res) => {
  res.json({
    myData: true
  });
});

app.get("/*", (req, res) => {
  const number = req.path.match(/\d/g) || 1;

  const myAppData = {
    test: number,
    path: req.path
  }

  const svelteData = main.render(myAppData);

  console.log(svelteData);

  const { html, css:{code:style} } = svelteData;

  res.send(`
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf8">
            <title>My Crazy adventure</title>
            <style>${style}</style>
        </head>
        <body>
            <div id="root">${html}</div>

            <script>
            // data for hydrate
            // this example does NOT protect against
            // XSS attacks!
            window.myApp = ${JSON.stringify(myAppData)}
            </script>

            <script src="/main.js"></script>
        </body>
    </html>
  `);
});

app.listen(8000, () => {
  console.log("Server started in port 8000");
});
