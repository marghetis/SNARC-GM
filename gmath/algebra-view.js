// Copyright by Erik Weitnauer, 2014.

/**
 * Available options and their defaults:
 *
 * - font_size: in px [80]
 * - color: css string ['#333']
 * - selection_color: css string ['lightblue']
 * - inactive_color: css string ['gray']
 * - fraction_size_factor: how much smaller are den. & num. rendered? [0.7]
 * - subscript_size_factor: [0.5]
 * - exp_size_factor: how much smaller are powers rendered? [0.7]
 * - debug_lines: show debug lines? [false]
 * - dur: duration of animations in ms [250]
 * - easing_fn: easing function for animations ['circle-out']
 * - pos: position of view in container [[0,0]]
 * - size: pass { width, height } to set view to a fixed size
 *         [{width: 'auto', height: 'auto'}]
 * - interaction_mode: intial mode of interaction, either 'transform' or 'change' ['transform']
 * - h_align: horizontal alignment of expression 'left', 'center' or 'right' ['center']
 * - v_align: vertical alignment of expression 'top', 'bottom', 'center' or
 *            'alphabetic' ['alphabetic']
 * - background_color: css string ['none']
 * - border_color: css string ['none']
 * - border_radius: border radius of the border rect [0]
 * - padding: padding around expression (this area allows for user interaction,
 *            too) [{ left: 0, right: 0, top: 0, bottom: 0}]
 * - shadow_color: fill color for shadow rect ['none']
 * - shadow_filter: reference to an svg filter for blurring the shadow rect [null]
 * - interactive: [true]
 * - event_receiver: the view will take events from this DOM element. By default
 *                   the passed container will be used [null]
 */
var AlgebraView = function(model, svg, options) {
  this.id = gmath.uid();
  this.model = model;
  this.events = d3.dispatch('updated');
  this.model.events.on('change.'+this.id, this.onChange.bind(this));
  var self = this;
  this.model.events.on('scrubbability-changed.'+this.id, function() {
    self.update_existing('normal', true);
  });
  this.svg = svg;
  this.main = null;
  this.initializeOptions(options);
  this.is_animating = 0;
  this.afterAnimationCallbacks = [];
}
gmath.AlgebraView = AlgebraView;

gmath.preloadFonts = function(fonts) {
  if (!gmath.AlgebraView.fontloader)
    gmath.AlgebraView.fontloader = new FontLoader(fonts);
  else gmath.AlgebraView.fontloader.add_fonts(fonts);
}

/// Binds this view to a new model. If a 1:1 node_map (which maps to elements,
/// not to arrays!) is passed, all current visual elements are updated to link
/// to the new nodes.
AlgebraView.prototype.bindToModel = function(model, node_map) {
  // unregister old change event listener and register new one
  if (this.model) {
    this.model.events.on('change.'+this.id, null);
    this.model.events.on('scrubbability-changed.'+this.id, null);
  }
  this.model = model;
  this.model.events.on('change.'+this.id, this.onChange.bind(this));
  // bind graphical elements to new data
  if (node_map && this.main) {
    this.main.selectAll('g.math').each(function(d) {
      var n = node_map[d.id];
      if (!d.deleted && n && n.length === 1 && !n[0].has_children()) d3.select(this).datum(n[0]);
    });
    this.main.selectAll('g.math_shadow').each(function(d) {
      var n = node_map[d.id];
      if (!d.deleted && n && n.length === 1 && !n[0].has_children()) d3.select(this).datum(n[0]);
    });
  }

  var self = this;
  this.model.events.on('scrubbability-changed.'+this.id, function() {
    self.update_existing('normal', true);
  });
}

AlgebraView.defaultOptions = {
  font_size: 80
, auto_update: true // automatically update if the linked AlgebraModel changes
, color: '#333'
, scrubbing_color: 'Blue'
, selection_color: '#ff8c00' //'lightblue'
, inactive_color: 'gray'
, fraction_size_factor: 0.7
, exp_size_factor: 0.7
, subscript_size_factor: 0.7
, smooshed_nodes_shrink_factor: 0.5
, debug_lines: false
, debug_draw: false
, dur: 300
, easing_fn: "cubic-in-out"
, pos: [0,0]
, interaction_mode: 'transform'
, v_align: 'alphabetic'
, h_align: 'center'
, background_color: 'none'
, bg_visible: false
, shadow_filter: null
, border_color: 'none'
, shadow_color: 'none'
, border_radius: 0
, padding: { left: 0, right: 0, top: 0, bottom: 0}
, interactive: true
, event_receiver: null
, normal_font: { family: 'Crimson Text' }
, italic_font: { family: 'Crimson Text Italics'}
, font_baseline_shift: 0.24
, font_ascent: 0.73
, font_descent: 0.18
, slanted_div_bar: false
, div_bar_height: 0.056 // in em
, wiggle_dur: 200 // ms per half cycle
, wiggle_deg: 10  // in degree
, wiggle_random_delay: 100 // in ms
, show_node_targets: true // show shadows where a dragged node will move when dropped
, shadow_node_stroke: '#888' // '#ddd'
, shadow_node_stroke_width: 0.75 //0.5
, shadow_node_fill: 'white'
, enable_drag_to_join: true // allow smooshing?
, visualize_scrubbable_nodes: false // show little triangles above and below scrubbable nodes?
}

AlgebraView.prototype.onChange = function(event) {
  if (event.old_model !== event.new_model) {
    this.bindToModel(event.new_model, event.node_map);
    if (this.options.auto_update) this.update_all(true);
  } else {
    if (this.options.auto_update) this.update_all(event.no_anim);
  }
}

AlgebraView.prototype.callAfterAnimation = function(callback) {
  if (!this.is_animating) callback();
  else this.afterAnimationCallbacks.push(callback);
}

AlgebraView.prototype.animationFinished = function() {
  this.is_animating = Math.max(0, this.is_animating-1);
  if (this.is_animating > 0) return;
  this.afterAnimationCallbacks.forEach(function(cb) { cb() });
  this.afterAnimationCallbacks = [];
}

AlgebraView.prototype.initializeOptions = function(options) {
  options = options || {};

  var default_opts = gmath.extend({}, AlgebraView.defaultOptions); // shallow copy
  default_opts.pos = default_opts.pos.slice();
  default_opts.padding = gmath.extend({}, default_opts.padding);
  default_opts.normal_font = gmath.extend({}, default_opts.normal_font);
  default_opts.italic_font = gmath.extend({}, default_opts.italic_font);

  this.options = gmath.extend(default_opts, options);

  if (options.padding) {
    var op = options.padding;
    if (typeof(op) === 'number') {
      this.options.padding = { left: op, right: op, top: op, bottom: op};
    }
    else gmath.extend(this.options.padding, op);
  }
}

AlgebraView.prototype.init = function(on_load) {
  this.main = this.svg.append('g')
    .attr('id', this.options.id)
    .attr('class', 'main')
    .attr('transform', 'translate('+this.options.pos+')');

  this.shadow_rect = this.main.append('rect')
      .attr({rx : this.options.border_radius, ry: this.options.border_radius})
      .style('fill', 'none')
      .attr('filter', this.options.shadow_filter)
      .style('stroke', this.options.shadow_color)
      .style('visibility', this.options.shadow_filter ? 'visible' : 'hidden');

  this.border_rect = this.main.append('rect')
      .attr({rx : this.options.border_radius, ry: this.options.border_radius})
      .style('fill', this.options.background_color)
      .style('stroke', this.options.border_color)
      .style('visibility', this.options.bg_visible ? 'visible' : 'hidden');

  if (this.options.event_receiver) {
    this.event_receiver = d3.select(this.options.event_receiver);
  } else {
    this.event_receiver = this.main;
  }
  this.event_receiver.style('pointer-events', 'visible');

  if (this.options.debug_lines) {
    this.main
      .append('line')
      .attr('x1', -1000)//-this.width/2)
      .attr('x2', 1000)//this.width/2)
      .attr('stroke-width', '0.5')
      .attr('stroke', 'lightblue');
    this.main
      .append('line')
      .attr('y1', -1000)//-this.height/2)
      .attr('y2', 1000)//this.height/2)
      .attr('stroke-width', '0.5')
      .attr('stroke', 'lightblue');
  }

  this.renderer = new NodeRenderer(this, this.options.h_align, this.options.v_align);
  this.interaction_handler = new InteractionHandler(this, this.options.interactive);
  this.main.classed('interactive', this.options.interactive);
  this.interaction_handler.set_mode(this.options.interaction_mode);
  var fonts = [this.options.normal_font, this.options.italic_font];
  if (!AlgebraView.fontloader) {
    AlgebraView.fontloader = FontLoader(fonts, 2000);
    this.fontloader = AlgebraView.fontloader;
  } else {
    this.fontloader = AlgebraView.fontloader;
    this.fontloader.add_fonts(fonts);
  }
  var self = this;
  this.fontloader.on_fonts_loaded(function() {
    self.update_all(true);
    if (on_load) on_load();
  });
}

/// Getter: If called without an argument, the method returns true if the
///         view can currently be interacted with and false if not.
/// Setter: If called with true or false as argument, enables or disables
///         interactivity for the view.
AlgebraView.prototype.interactive = function(arg) {
  if (arguments.length === 0) return this.options.interactive;
  this.options.interactive = arg;
  this.interaction_handler.set_interactive(arg);
  this.main.classed('interactive', this.options.interactive);
  return this;
}

// Takes a single or an array of selector strings like "x+y".
// For example, to wiggle the 1, +2, and +4 parts of 1+2+3+4,
// pass ['1+2', '+4'].
AlgebraView.prototype.wiggle = function(sels, enable) {
  if (!Array.isArray(sels)) sels = [sels];
  var ranges = [];
  for (var i=0; i<sels.length; i++) {
    var parts = sels[i].split(':');
    var range = (parts.length === 1) ? this.model.getRanges(parts[0])
                                     : this.model.getRanges(parts[0], Number(parts[1])-1);
    if (range) ranges = ranges.concat(range);
  }
  var nodes = gmath.array.flatten(ranges);
  if (nodes.length === 0) return;
  this.wiggleNodes(nodes, enable);
  this.interaction_handler.events
    .on( 'touch.'+this.id, this.wiggleNodes.bind(this, null, false));
}

// Takes a single node or an array of nodes and a bool enable (defaut: true).
// Begins or ends wiggling animation for all nodes in array. If no nodes are
// passed, it selects all nodes.
AlgebraView.prototype.wiggleNodes = function (nodes, enable) {
  if (arguments.length < 2) enable = true;
  if (!nodes) nodes = this.model.children;
  if (!Array.isArray(nodes)) nodes = [nodes];
  var leafs = [];
  nodes.forEach(function(n) { if (n.has_children()) leafs = leafs.concat(n.get_leaf_nodes()); else leafs.push(n); });
  var gs = this.node_sel.filter(function(d) { return leafs.indexOf(d) !== -1 })
               .select('g.offset');
  var opts = this.options;
  var rot_tween = function(from, to, pos) {
    var i = d3.interpolate(from, to);
    return function(d) {
      var pos = AlgebraView.getCenter(d);
      return function(t) { return 'rotate(' + i(t) + ' ' + pos + ')'; }
    }
  }
  function repeat(d) {
    d3.select(this)
     .transition()
     .duration(opts.wiggle_dur)
     .attrTween("transform", rot_tween(opts.wiggle_deg, -opts.wiggle_deg))
     .transition()
     .duration(opts.wiggle_dur)
     .attrTween("transform", rot_tween(-opts.wiggle_deg, opts.wiggle_deg))
     .each('end', repeat);
  }
  if (enable) {
    gs.transition()
      .delay(function () { return Math.random() * opts.wiggle_random_delay }) // random time offset per element
      .duration(opts.wiggle_dur/2)
      .attrTween("transform", rot_tween(0, opts.wiggle_deg))
      .each('end', repeat);
  } else {
    gs.interrupt().transition().attr('transform', null);
  }
}

AlgebraView.getCenter = function(node) {
  var bbox = node.sel_box;
  return [(bbox.x + bbox.width / 2), (-node.size*0.24)];
}

AlgebraView.prototype.reposition = function(event) {
  var thiz = this;
  //d3.timer(function() {
    thiz.renderer.set_position(thiz.model.children, true);
    thiz.update_existing();
  //  return true;
  //});
}

AlgebraView.prototype.enterSmooshed = function(nodes) {
  var self = this;

  var selection = this.main.selectAll('g.math_smooshed')
        .data(gmath.array.flatten(nodes), function(d) { return d.id });

  var entering = selection.enter()
    .insert('g', 'g')
    .classed('math_smooshed', true)
    .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")" })
    .attr("opacity", 0.6);

  entering.append('g').classed('offset', true);

  // the rectangle for selecting elements and for correct drawing (no smearing during dragging)
  entering.select('g.offset').append('rect')
    .attr('visibility', this.options.debug_draw ? 'visible' : 'hidden')
    .style('stroke', 'black')
    .style('fill', 'none')
    .classed("selector", true);

  // symbols
  entering.select('g.offset').append("text")
    .attr("font-family", function(d) { return self.get_font(d).family })
    .attr("font-weight", function(d) { return self.get_font(d).weight })
    .attr("font-style", function(d) { return self.get_font(d).style })
    .attr("font-size", function(d) { return d.size+"px" })
    .attr("fill", function(d) { return self.options.selection_color })
    .attr("opacity", function(d) { return d.hidden ? 1e-5 : 1 })
    .text(function(d) { return d.to_string() });

  entering.select('text')
    .transition()
    .duration(this.options.dur)
    .ease(this.options.easing_fn)
    .attr("font-size", function(d) { return d.size*self.options.smooshed_nodes_shrink_factor+"px" });
}

AlgebraView.prototype.updateSmooshed = function(nodes) {
  var self = this;
  var selection = this.main.selectAll('g.math_smooshed')
        .data(gmath.array.flatten(nodes), function(d) { return d.id });

  selection
    .transition()
    .duration(this.options.dur)
    .ease("circle-out")
    .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")" });
}

AlgebraView.prototype.exitSmooshed = function() {
  this.main.selectAll('g.math_smooshed').data([]).exit().remove();
}

AlgebraView.prototype.enterSmooshIndicator = function(center) {
  var selection = this.main.selectAll('.smooshIndicator')
        .data([center]);

  var enter = selection.enter();

  enter.insert('circle')
    .classed('smooshIndicator', true)
    .attr('transform', function(d) {return 'translate(' + d[0] + ',' + d[1] + ')' })
    .attr('r', 5)
    .style({fill: this.options.selection_color, opacity: 0.5});
}

AlgebraView.prototype.updateSmooshIndicator = function(center) {
  var selection = this.main.selectAll('.smooshIndicator')
        .data([center]);

  selection
    .attr('transform', function(d) {return 'translate(' + d[0] + ',' + d[1] + ')' })
}

AlgebraView.prototype.exitSmooshIndicator = function() {
  var selection = this.main.select('.smooshIndicator').data([]).exit().remove();
}

AlgebraView.prototype.update_all = function(no_anim) {
  // challenge: for x*(1+2) the new x's should appear at the position of the old x ==> call enter_no_anim first
  // instead of using a property enter_as_is on the nodes, we'll use the node mappings later
  // TODO: we need two independent factors
  //   1. show/hide immediately VS animate opacity
  //   2. create/remove at current position VS computed position
  var old_dur = this.options.dur;
  if (no_anim) this.options.dur = 0;
  this.renderer.set_style(this.model.children);
  this.renderer.set_position(this.model.children, true);
  this.enter_and_exit('normal');
  this.update_existing('normal');

  this.events.updated({ type: 'updated', source: this, sender_id: this.id });
  this.is_animating++;
  setTimeout(this.animationFinished.bind(this), this.options.dur);
  this.options.dur = old_dur;
}

AlgebraView.prototype.enter_and_exit = function(nodeType) {
  var selection;

  if (nodeType==='normal') {
    selection = this.getNormalNodesSelection();
  } else if (nodeType==='shadow') {
    selection = this.getShadowNodesSelection();
  } else {
    throw "No node type specified for node visualization -- AlgebraView.js/enter_and_exit";
  }

  if (selection.length>0) {
    this._enter(selection, nodeType);
    selection.selectAll('g.math text').on('hold', function(m) {
      var datum = m.datum();
      if (!gmath.actions.splitNumberWithKeyboardAction.match(datum)) return;
      var action = gmath.actions.splitNumberWithKeyboardAction.createBoundAction(datum.get_root(), {actor: datum});
      datum.get_root().performAction(action, null, true);
    })
    this._exit(selection, nodeType);
  }
}

AlgebraView.prototype.getNormalNodesSelection = function() {
  var selection = this.main.selectAll('g.math')
    .data(Tree.get_leaf_nodes(this.model.children), function(d) { return d.id });

  return selection;
}

AlgebraView.prototype.getShadowNodesSelection = function() {
  if (!this.options.show_node_targets) {
    return [];
  }

  var dragged_nodes = this.model.filter(function(n) { return n.dragging; });
  var dragged_leaves = Tree.filter(function(n) {
    return !n.has_children();
  }, dragged_nodes);

  var selection = this.main.selectAll('g.math_shadow')
    .data(dragged_leaves, function(d) { return d.id; });

  return selection;
}

AlgebraView.prototype._enter = function(selection, nodeType) {
  var self = this;

  var te;
  if (nodeType === 'normal') {
    te = selection.enter()
      .append('g')
      .classed('math', true)
      .attr('id', function (d) { return d.id; })
      .attr('transform', function(d) { return "translate("+ d.x + "," + d.y + ")" });
  } else {
    te = selection.enter()
      .insert('g', 'g.math')
      .classed('math_shadow', true)
      .attr("transform", function(d) { return "translate(" + d.x0 + "," + d.y0 + ")" })
      .each(function(d) {d.shadow_deleted = false});
  }

  te.append('g').classed('offset', true); // used for wiggling

  // the rectangle for selecting elements and for correct drawing (no smearing during dragging)
  te.select('g.offset').append('rect')
    .attr('visibility', this.options.debug_draw ? 'visible' : 'hidden')
    .style('stroke', 'black')
    .style('fill', 'none')
    .classed("selector", true)
    .style('pointer-events', 'all');

  var divisionBar = te.filter(function(d) {
    return d.value==='//';
  }).select('g.offset');

  var dbline = divisionBar.append('line')
      .style('stroke-linecap', 'round')
      .call(style_division_bar, this.options.slanted_div_bar, nodeType)
      .attr("opacity", function(d) {
        return (nodeType==='normal') ? (d.no_anim && !d.hidden ? 1 : 1e-5)
                                     : (d.hidden || d.hide_after_drop ? 0 : 1) });

  // symbols
  var textSelection = te.select('g.offset').append("text")
    .attr("font-family", function(d) { return self.get_font(d).family })
    .attr("font-weight", function(d) { return self.get_font(d).weight })
    .attr("font-style", function(d) { return self.get_font(d).style })
    .attr("font-size", function(d) { return d.size+"px" })
    .style('pointer-events', 'none');
  if (nodeType==='normal') {
    textSelection.attr("stroke", "none")
      .attr("fill", function(d) { return d.color })
      .attr("opacity", function(d) { return d.no_anim && !d.hidden ? 1 : 1e-5 })
      .text(function(d) { return d.to_string() });

    if (this.options.debug_draw) this.debugDraw(te);

    selection.each(function (d) { return d.no_anim = false });
  } else {
    textSelection.style("stroke", self.options.shadow_node_stroke)
      .style("stroke-width", self.options.shadow_node_stroke_width)
      .style("fill", self.options.shadow_node_fill)
      .attr("opacity", function(d) { return (d.hidden || d.hide_after_drop) && !d.smooshing ? 0 : 1 });
  }

  return te;
}

AlgebraView.prototype._exit = function(selection, nodeType) {
  var self = this;
  var ex = selection.exit()
    .each(function(d) { if (nodeType==='normal') {d.deleted = true} else {d.shadow_deleted = true} })
    .transition()
    .ease("linear")
    .duration(function(d) { return d.no_anim ? 0 : self.options.dur })
    .attr("transform", function(d) { return "translate("+ (d.x||0) + "," + (d.y||0) + ")"})
    .remove();
  ex.select("*")
    .attr("opacity", 1e-5);

  if (nodeType==='normal') {
    this.node_sel = selection;
  }
}

AlgebraView.prototype.update_existing = function(nodeType, no_anim) {
  var self = this;

  var selection = this.svg.selectAll(nodeType==='normal' ? 'g.math' : 'g.math_shadow')
        .filter(function(d) { if (nodeType==='normal') return !d.deleted; else return !d.shadow_deleted; });

  var locationTransformation = selection.transition()
        .duration(no_anim ? 0 : this.options.dur)
        .ease(this.options.easing_fn);
  if (nodeType==='normal') {
    locationTransformation.attr("transform", function(d) { return "translate("+ (d.x||0) + "," + (d.y||0) + ")"});
  } else {
    locationTransformation.attr("transform", function(d) { return "translate("+ (d.x0||0) + "," + (d.y0||0) + ")"});
  }

  var trans = selection.select("text")
        .transition()
        .duration(0)
        .text(function(d) { return d.to_string() })
        .transition()
        .duration(no_anim ? 0 : this.options.dur)
        .ease("linear")
        .attr("font-size", function(d) { return d.size + "px"});
  if (nodeType==='normal') {
    trans.attr("fill", function(d) { return d.color })
      .attr("opacity", function(d) { return d.hidden ? 1e-5 : 1 });
  } else {
    trans.attr('opacity', function(d) { return (d.hidden || d.hide_after_drop) && !d.smooshing ? 0 : 1 })
  }

  var divisionLineSelection = nodeType==='normal' ? selection.select('line') : selection.filter(function(d) {return d.value==='//'}).select('line');
  divisionLineSelection
    .transition()
    .duration(no_anim ? 0 : this.options.dur)
    .ease("linear")
    .call(style_division_bar, this.options.slanted_div_bar, nodeType)
    .attr("opacity", function(d) {
      if (nodeType==='normal') return (d.hidden ? 1e-5 : 1);
      else return (d.hidden || d.hide_after_drop ? 0 : 1);
    });

  if (nodeType==='normal') {
    if (this.options.visualize_scrubbable_nodes && this.options.interaction_mode==='inspect') {
      var scrub_els = selection.each(function(d) {
        var el = d3.select(this);
        var els = el.selectAll('.scrub');
        if (els.size() === 0 && Num.is_num(d) && !d.fixed && !d.locked) {
          el.append('path').attr({class: 'scrub', d: 'M-.5,0 L.5,0 L0,-.7 Z'});
          el.append('path').attr({class: 'scrub', d: 'M-.5,0 L.5,0 L0,.7 Z'});
          els = el.selectAll('.scrub');
          els.style({fill: d.color, 'stroke-linejoin': 'round', stroke: d.color, 'stroke-width': '0.3px', opacity: .5});
        }
        els.attr('visibility', !d.locked ? 'visible' : 'hidden');
        els.attr('transform', function(d,i) {
          return i===0 ? 'translate(' + [d.sel_box.x+d.sel_box.width/2, -d.ascent] + ')scale(' + d.size/5 + ')'
                       : 'translate(' + [d.sel_box.x+d.sel_box.width/2, d.descent] + ')scale(' + d.size/5 + ')';
        });
      });
    } else {
      selection.selectAll('.scrub').remove();
    }

    selection.select("rect")
    // .transition()
    // .duration(no_anim ? 0 : this.options.dur)
    // .ease(this.options.easing_fn)
      .attr('x', function(d) { return d.sel_box ? d.sel_box.x : 0})
      .attr('y', function(d) { return d.sel_box ? d.sel_box.y : 0})
      .attr('width', function(d) { return (d.hidden || !d.sel_box) ? 0 : d.sel_box.width }) // don't allow grabbing of
      .attr('height', function(d) { return (d.hidden || !d.sel_box) ? 0 : d.sel_box.height });  // hidden elements

    this.update_background();
  }
  return true;
}

AlgebraView.prototype.update_background = function(no_anim) {
  var main_node = this.model.children[0];
  var bbox = this.getBBox();
  if (main_node && !main_node.dragging) {
    this.border_rect
      .attr({rx : this.options.border_radius, ry: this.options.border_radius})
      .style('fill', this.options.background_color)
      .style('stroke', this.options.border_color)
      .attr(bbox);
    this.shadow_rect.transition()
      .duration(no_anim ? 0 : this.options.dur)
      .attr(bbox);
  }
}

AlgebraView.prototype.set_background_visible = function(val) {
  this.options.bg_visible = !!val;
  this.border_rect.style('visibility', val ? 'visible' : 'hidden');
}

/// Returns the current bounding box of the view including the padding set
/// in the options.
/// You can pass { no_padding: true } to get the bounding box without padding.
AlgebraView.prototype.getBBox = function(opts) {
  opts = opts || {};
  var n = this.model.children[0];
  if (!n || !n.sel_box) return {x:0, y:0, width: 0, height: 0};
  var bbox = {};
  var padding = this.options.padding;
  bbox.x = n.sel_box.x + (n.dragging ? n.x0 : n.x)
         - (opts.no_padding ? 0 : padding.left);
  bbox.y = n.sel_box.y + (n.dragging ? n.y0 : n.y)
         - (opts.no_padding ? 0 : padding.top);
  bbox.width = n.sel_box.width
             + (opts.no_padding ? 0 : padding.left + padding.right);
  bbox.height = n.sel_box.height
              + (opts.no_padding ? 0 : padding.top + padding.bottom);
  return bbox;
}

/// For dragged nodes (different easing function).
AlgebraView.prototype.update_positions = function() {
  this.node_sel
    .transition()
    .duration(this.options.dur)
    .ease("circle-out")
    .attr("transform", function(d) { return "translate("+ (d.x||0) + "," + (d.y||0) + ")"});
}

AlgebraView.prototype.update_style = function(no_anim) {
  var self = this;
  this.node_sel.select("text")
     .transition()
     .duration(no_anim ? 0 : this.options.dur)
     .ease("linear")
     .attr("font-size", function(d) { return d.size + "px"})
     .attr("fill", function(d) { return d.color })
     .attr("opacity", function(d) {
        if (d.hidden) return 1e-5;
        if (d.hide_after_drop) return 0.4;
        return 1;
      });

  this.node_sel.select("line")
    .transition()
    .duration(no_anim ? 0 : this.options.dur)
    .ease("linear")
    .call(style_division_bar, this.options.slanted_div_bar)
    .attr("opacity", function(d) {
      if (d.hidden) return 1e-5;
      if (d.hide_after_drop) return 0.4;
      return 1;
    });
}

function style_division_bar(selection, slanted, nodeType) {
  selection
    .attr('x1', 0)
    .attr('x2', function(d) { return d.width })
    .style('stroke-width', function(d) { return (nodeType === 'normal' || !nodeType) ? d.height : d.height/2 })
    .style('stroke', function(d) { return (nodeType === 'normal' || !nodeType) ? d.color : '#ddd' });
  if (slanted) {
    selection.attr('y1', function(d) { return 0.2*d.height })
      .attr('y2', function(d) { return -0.2*d.height })
  }
}

AlgebraView.prototype.force_refresh = function() {
  var n = this.svg.node();
  n.style.display='none';
  n.style.display='block';
}

AlgebraView.prototype.get_utf8 = function(d) {
  var mappings = {'-': '−', '*': '·', '/': ''};//∗·•×−
  if (d.value in mappings) return mappings[d.value];
  if (typeof(d.value) == 'number' && d.value < 0) return mappings['-'] + Math.abs(d.value);
  return d.value;
}

AlgebraView.prototype.get_font = function(d) {
  return (d instanceof Var) ? this.options.italic_font : this.options.normal_font;
}

AlgebraView.prototype.get_width = function(d) {
  return this.fontloader.width(d.to_string(), d.size, get_font(d));
}

// For debugging font metrics
AlgebraView.prototype.debugDraw = function(node_els) {
  var self = this;
  node_els.select('g.offset').append('rect')
    .style('stroke', 'orange')
    .style('opacity', function(d) { return d.hidden ? 0.3 : 1 })
    .style('fill', 'none')
    .attr({ x: function(d) { return d.sel_box.x }
          , width: function(d) { return d.sel_box.width }
          , y: function(d) { return d.size * self.options.font_descent - 0.5}
          , height: 10})

  // For debugging font metrics
  node_els.select('g.offset').append('rect')
    .style('stroke', 'green')
    .style('opacity', function(d) { return d.hidden ? 0.3 : 1 })
    .style('fill', 'none')
    .attr({ x: function(d) { return d.sel_box.x }
          , width: function(d) { return d.sel_box.width }
          , y: function(d) { return -d.size * self.options.font_ascent - 0.5}
          , height: 10})

  // For debugging font metrics
  node_els.select('g.offset').append('rect')
    .style('stroke', 'blue')
    .style('opacity', function(d) { return d.hidden ? 0.3 : 1 })
    .style('fill', 'none')
    .attr({ x: function(d) { return d.sel_box.x }
          , width: function(d) { return d.sel_box.width }
          , y: function(d) { return -d.size * self.options.font_baseline_shift - 0.5}
          , height: 10})

}

///**
//Things that get updated:
//- font-size and color of nodes (a)  ==> set_styl(nodes)
//- dimensions of nodes & positioning (p)  ==> set_position(nodes, update_dims)

//- size, color, position of svg elements (A)  ==> update_existing()
//- existence of svg-g (E)  ==> enter_and_exit()

//Occasions to update them:
//- initially (a p E A)
//- after simplifying (a p E A)
//- start touch (a A)
//- start dragging (a p A)
//- during dragging (A)
//- moving terms (p(false) E A)
//- end touch (a A)
//*/
