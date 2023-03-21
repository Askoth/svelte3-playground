import Main from "./main.svelte";

const app = new Main({
  target: document.querySelector("#root"),
  hydrate: true,
  props: window.myApp
});
