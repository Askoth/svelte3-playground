import Main from "./main.html";

const app = new Main({
  target: document.querySelector("#root"),
  hydrate: true,
  props: window.myApp
});
