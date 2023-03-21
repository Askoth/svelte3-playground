hello world {test}

<svelte:component this="{currentSelection}" />

<script>
  import foo from "./foo.svelte";
  import bar from "./bar.svelte";

  export let test;
  export let path;

  let currentSelection;

  switch (path) {
    case "/bar":
      currentSelection = bar;
      break;
    default:
      currentSelection = foo;
      break;
  }
</script>
