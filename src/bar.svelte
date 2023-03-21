<div>this is bar {check}</div>

<button class="button" on:click={something}>click me!</button>

<div>Clicked {num} times.</div>

<dl>
  <dt>Derivative:</dt>
  <dd>{myDerivative}</dd>
</dl>

<script>

  console.log("We are now at bar")

  let check = "not clicked";
  let num = 0;

  $: myDerivative = `${check} ${num}`;

  function something() {
    check = "clicked";
    num++;
  }
</script>

<style>
  .button {
    background-color: darkgreen;
    color: white;
  }
</style>
