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

  const wat = main.render({
    test: number,
    path: req.path
  });

  console.log(wat);

  const { html } = wat;

  res.send(`
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf8">
            <title>My Crazy adventure</title>
        </head>
        <body>
            <div id="root">${html}</div>

            <script>
            // data for hydrate
            </script>

            <script src="/main.js"/>
        </body>
    </html>
  `);
});

app.listen(8000, () => {
  console.log("Server started in port 8000");
});
