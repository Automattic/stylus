
/*!
 * Stylus - RGBA
 * Copyright (c) Automattic <developer.wordpress.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

import {Node} from './node';
import {HSLA} from './hsla';
import functions = require('../functions');
var adjust = functions.adjust;
import nodes = require('./');

/**
 * Initialize a new `RGBA` with the given r,g,b,a component values.
 *
 * @param {Number} r
 * @param {Number} g
 * @param {Number} b
 * @param {Number} a
 * @api public
 */

export class RGBA extends Node {
  r;
  g;
  b;
  a;
  name;
  rgba;
  raw;

  constructor(r,g,b,a){
  super();
  this.r = clamp(r);
  this.g = clamp(g);
  this.b = clamp(b);
  this.a = clampAlpha(a);
  this.name = '';
  this.rgba = this;
}

/**
 * Return an `RGBA` without clamping values.
 * 
 * @param {Number} r
 * @param {Number} g
 * @param {Number} b
 * @param {Number} a
 * @return {RGBA}
 * @api public
 */

static withoutClamping(r,g,b,a){
  var rgba = new RGBA(0,0,0,0);
  rgba.r = r;
  rgba.g = g;
  rgba.b = b;
  rgba.a = a;
  return rgba;
}

/**
 * Return a clone of this node.
 * 
 * @return {Node}
 * @api public
 */

clone(){
  var clone = new RGBA(
      this.r
    , this.g
    , this.b
    , this.a);
  clone.raw = this.raw;
  clone.name = this.name;
  clone.lineno = this.lineno;
  clone.column = this.column;
  clone.filename = this.filename;
  return clone;
}

/**
 * Return a JSON representation of this node.
 *
 * @return {Object}
 * @api public
 */

toJSON(){
  return {
    __type: 'RGBA',
    r: this.r,
    g: this.g,
    b: this.b,
    a: this.a,
    raw: this.raw,
    name: this.name,
    lineno: this.lineno,
    column: this.column,
    filename: this.filename
  };
}

/**
 * Return true.
 *
 * @return {Boolean}
 * @api public
 */

toBoolean(){
  return nodes.trueNode;
}

/**
 * Return `HSLA` representation.
 *
 * @return {HSLA}
 * @api public
 */

get hsla(){
  return HSLA.fromRGBA(this);
}

/**
 * Return hash.
 *
 * @return {String}
 * @api public
 */

get hash(){
  return this.toString();
}

/**
 * Add r,g,b,a to the current component values.
 *
 * @param {Number} r
 * @param {Number} g
 * @param {Number} b
 * @param {Number} a
 * @return {RGBA} new node
 * @api public
 */

add(r,g,b,a){
  return new RGBA(
      this.r + r
    , this.g + g
    , this.b + b
    , this.a + a);
}

/**
 * Subtract r,g,b,a from the current component values.
 *
 * @param {Number} r
 * @param {Number} g
 * @param {Number} b
 * @param {Number} a
 * @return {RGBA} new node
 * @api public
 */

sub(r,g,b,a){
  return new RGBA(
      this.r - r
    , this.g - g
    , this.b - b
    , a == 1 ? this.a : this.a - a);
}

/**
 * Multiply rgb components by `n`.
 *
 * @param {String} n
 * @return {RGBA} new node
 * @api public
 */

multiply(n){
  return new RGBA(
      this.r * n
    , this.g * n
    , this.b * n
    , this.a); 
}

/**
 * Divide rgb components by `n`.
 *
 * @param {String} n
 * @return {RGBA} new node
 * @api public
 */

divide(n){
  return new RGBA(
      this.r / n
    , this.g / n
    , this.b / n
    , this.a); 
}

/**
 * Operate on `right` with the given `op`.
 *
 * @param {String} op
 * @param {Node} right
 * @return {Node}
 * @api public
 */

operate(op, right){
  if ('in' != op) right = right.first

  switch (op) {
    case 'is a':
      if ('string' == right.nodeName && 'color' == right.string) {
        return nodes.trueNode;
      }
      break;
    case '+':
      switch (right.nodeName) {
        case 'unit':
          var n = right.val;
          switch (right.type) {
            case '%': return adjust(this, new nodes.StringNode('lightness'), right);
            case 'deg': return this.hsla.adjustHue(n).rgba;
            default: return this.add(n,n,n,0);
          }
        case 'rgba':
          return this.add(right.r, right.g, right.b, right.a);
        case 'hsla':
          return this.hsla.add(right.h, right.s, right.l);
      }
      break;
    case '-':
      switch (right.nodeName) {
        case 'unit':
          var n = right.val;
          switch (right.type) {
            case '%': return adjust(this, new nodes.StringNode('lightness'), new nodes.Unit(-n, '%'));
            case 'deg': return this.hsla.adjustHue(-n).rgba;
            default: return this.sub(n,n,n,0);
          }
        case 'rgba':
          return this.sub(right.r, right.g, right.b, right.a);
        case 'hsla':
          return this.hsla.sub(right.h, right.s, right.l);
      }
      break;
    case '*':
      switch (right.nodeName) {
        case 'unit':
          return this.multiply(right.val);
      }
      break;
    case '/':
      switch (right.nodeName) {
        case 'unit':
          return this.divide(right.val);
      }
      break;
  }
  return super.operate(op, right);
}

/**
 * Return #nnnnnn, #nnn, or rgba(n,n,n,n) string representation of the color.
 *
 * @return {String}
 * @api public
 */

toString(){
  function pad(n) {
    return n < 16
      ? '0' + n.toString(16)
      : n.toString(16);
  }

  // special case for transparent named color
  if ('transparent' == this.name)
    return this.name;

  if (1 == this.a) {
    var r = pad(this.r)
      , g = pad(this.g)
      , b = pad(this.b);

    // Compress
    if (r[0] == r[1] && g[0] == g[1] && b[0] == b[1]) {
      return '#' + r[0] + g[0] + b[0];
    } else {
      return '#' + r + g + b;
    }
  } else {
    return 'rgba('
      + this.r + ','
      + this.g + ','
      + this.b + ','
      + (+this.a.toFixed(3)) + ')';
  }
}

/**
 * Return a `RGBA` from the given `hsla`.
 *
 * @param {HSLA} hsla
 * @return {RGBA}
 * @api public
 */

static fromHSLA(hsla){
  var h = hsla.h / 360
    , s = hsla.s / 100
    , l = hsla.l / 100
    , a = hsla.a;

  var m2 = l <= .5 ? l * (s + 1) : l + s - l * s
    , m1 = l * 2 - m2;

  var r = hue(h + 1/3) * 0xff
    , g = hue(h) * 0xff
    , b = hue(h - 1/3) * 0xff;

  function hue(h) {
    if (h < 0) ++h;
    if (h > 1) --h;
    if (h * 6 < 1) return m1 + (m2 - m1) * h * 6;
    if (h * 2 < 1) return m2;
    if (h * 3 < 2) return m1 + (m2 - m1) * (2/3 - h) * 6;
    return m1;
  }
  
  return new RGBA(r,g,b,a);
}
}

/**
 * Clamp `n` >= 0 and <= 255.
 *
 * @param {Number} n
 * @return {Number}
 * @api private
 */

function clamp(n) {
  return Math.max(0, Math.min(n.toFixed(0), 255));
}

/**
 * Clamp alpha `n` >= 0 and <= 1.
 *
 * @param {Number} n
 * @return {Number}
 * @api private
 */

function clampAlpha(n: number): number {
  return Math.max(0, Math.min(n, 1));
}
