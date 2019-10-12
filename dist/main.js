(function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function claim_element(nodes, name, attributes, svg) {
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (node.nodeName === name) {
                for (let j = 0; j < node.attributes.length; j += 1) {
                    const attribute = node.attributes[j];
                    if (!attributes[attribute.name])
                        node.removeAttribute(attribute.name);
                }
                return nodes.splice(i, 1)[0]; // TODO strip unwanted attributes
            }
        }
        return svg ? svg_element(name) : element(name);
    }
    function claim_text(nodes, data) {
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (node.nodeType === 3) {
                node.data = '' + data;
                return nodes.splice(i, 1)[0];
            }
        }
        return text(data);
    }
    function claim_space(nodes) {
        return claim_text(nodes, ' ');
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    /* src/foo.html generated by Svelte v3.12.1 */

    function create_fragment(ctx) {
    	var t;

    	return {
    		c() {
    			t = text("this is foo");
    		},

    		l(nodes) {
    			t = claim_text(nodes, "this is foo");
    		},

    		m(target, anchor) {
    			insert(target, t, anchor);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d(detaching) {
    			if (detaching) {
    				detach(t);
    			}
    		}
    	};
    }

    function instance($$self) {
    	console.log("We are now at foo");

    	return {};
    }

    class Foo extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, []);
    	}
    }

    /* src/bar.html generated by Svelte v3.12.1 */

    function add_css() {
    	var style = element("style");
    	style.id = 'svelte-1t0ylgc-style';
    	style.textContent = ".button.svelte-1t0ylgc{background-color:darkgreen;color:white}";
    	append(document.head, style);
    }

    function create_fragment$1(ctx) {
    	var div0, t0, t1, t2, button, t3, t4, div1, t5, t6, t7, t8, dl, dt, t9, dd, t10, dispose;

    	return {
    		c() {
    			div0 = element("div");
    			t0 = text("this is bar ");
    			t1 = text(ctx.check);
    			t2 = space();
    			button = element("button");
    			t3 = text("click me!");
    			t4 = space();
    			div1 = element("div");
    			t5 = text("Clicked ");
    			t6 = text(ctx.num);
    			t7 = text(" times.");
    			t8 = space();
    			dl = element("dl");
    			dt = element("dt");
    			t9 = text("Derivative:");
    			dd = element("dd");
    			t10 = text(ctx.myDerivative);
    			this.h();
    		},

    		l(nodes) {
    			div0 = claim_element(nodes, "DIV", {}, false);
    			var div0_nodes = children(div0);

    			t0 = claim_text(div0_nodes, "this is bar ");
    			t1 = claim_text(div0_nodes, ctx.check);
    			div0_nodes.forEach(detach);
    			t2 = claim_space(nodes);

    			button = claim_element(nodes, "BUTTON", { class: true }, false);
    			var button_nodes = children(button);

    			t3 = claim_text(button_nodes, "click me!");
    			button_nodes.forEach(detach);
    			t4 = claim_space(nodes);

    			div1 = claim_element(nodes, "DIV", {}, false);
    			var div1_nodes = children(div1);

    			t5 = claim_text(div1_nodes, "Clicked ");
    			t6 = claim_text(div1_nodes, ctx.num);
    			t7 = claim_text(div1_nodes, " times.");
    			div1_nodes.forEach(detach);
    			t8 = claim_space(nodes);

    			dl = claim_element(nodes, "DL", {}, false);
    			var dl_nodes = children(dl);

    			dt = claim_element(dl_nodes, "DT", {}, false);
    			var dt_nodes = children(dt);

    			t9 = claim_text(dt_nodes, "Derivative:");
    			dt_nodes.forEach(detach);

    			dd = claim_element(dl_nodes, "DD", {}, false);
    			var dd_nodes = children(dd);

    			t10 = claim_text(dd_nodes, ctx.myDerivative);
    			dd_nodes.forEach(detach);
    			dl_nodes.forEach(detach);
    			this.h();
    		},

    		h() {
    			attr(button, "class", "button svelte-1t0ylgc");
    			dispose = listen(button, "click", ctx.something);
    		},

    		m(target, anchor) {
    			insert(target, div0, anchor);
    			append(div0, t0);
    			append(div0, t1);
    			insert(target, t2, anchor);
    			insert(target, button, anchor);
    			append(button, t3);
    			insert(target, t4, anchor);
    			insert(target, div1, anchor);
    			append(div1, t5);
    			append(div1, t6);
    			append(div1, t7);
    			insert(target, t8, anchor);
    			insert(target, dl, anchor);
    			append(dl, dt);
    			append(dt, t9);
    			append(dl, dd);
    			append(dd, t10);
    		},

    		p(changed, ctx) {
    			if (changed.check) {
    				set_data(t1, ctx.check);
    			}

    			if (changed.num) {
    				set_data(t6, ctx.num);
    			}

    			if (changed.myDerivative) {
    				set_data(t10, ctx.myDerivative);
    			}
    		},

    		i: noop,
    		o: noop,

    		d(detaching) {
    			if (detaching) {
    				detach(div0);
    				detach(t2);
    				detach(button);
    				detach(t4);
    				detach(div1);
    				detach(t8);
    				detach(dl);
    			}

    			dispose();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	console.log("We are now at bar");

      let check = "not clicked";
      let num = 0;

      function something() {
        $$invalidate('check', check = "clicked");
        $$invalidate('num', num++, num);
      }

    	let myDerivative;

    	$$self.$$.update = ($$dirty = { check: 1, num: 1 }) => {
    		if ($$dirty.check || $$dirty.num) { $$invalidate('myDerivative', myDerivative = `${check} ${num}`); }
    	};

    	return { check, num, something, myDerivative };
    }

    class Bar extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-1t0ylgc-style")) add_css();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
    	}
    }

    /* src/main.html generated by Svelte v3.12.1 */

    function create_fragment$2(ctx) {
    	var t0, t1, t2, switch_instance_anchor, current;

    	var switch_value = ctx.currentSelection;

    	function switch_props(ctx) {
    		return {};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props());
    	}

    	return {
    		c() {
    			t0 = text("hello world ");
    			t1 = text(ctx.test);
    			t2 = space();
    			if (switch_instance) switch_instance.$$.fragment.c();
    			switch_instance_anchor = empty();
    		},

    		l(nodes) {
    			t0 = claim_text(nodes, "hello world ");
    			t1 = claim_text(nodes, ctx.test);
    			t2 = claim_space(nodes);
    			if (switch_instance) switch_instance.$$.fragment.l(nodes);
    			switch_instance_anchor = empty();
    		},

    		m(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, t1, anchor);
    			insert(target, t2, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},

    		p(changed, ctx) {
    			if (!current || changed.test) {
    				set_data(t1, ctx.test);
    			}

    			if (switch_value !== (switch_value = ctx.currentSelection)) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;
    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});
    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());

    					switch_instance.$$.fragment.c();
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},

    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

    			current = true;
    		},

    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(t0);
    				detach(t1);
    				detach(t2);
    				detach(switch_instance_anchor);
    			}

    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	

      let { test, path } = $$props;

      let currentSelection;

      switch (path) {
        case "/bar":
          $$invalidate('currentSelection', currentSelection = Bar);
          break;
        default:
          $$invalidate('currentSelection', currentSelection = Foo);
          break;
      }

    	$$self.$set = $$props => {
    		if ('test' in $$props) $$invalidate('test', test = $$props.test);
    		if ('path' in $$props) $$invalidate('path', path = $$props.path);
    	};

    	return { test, path, currentSelection };
    }

    class Main extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, ["test", "path"]);
    	}
    }

    const app = new Main({
      target: document.querySelector("#root"),
      hydrate: true,
      props: window.myApp
    });

}());
