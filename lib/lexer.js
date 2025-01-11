
/*!
 * Stylus - Lexer
 * Copyright (c) Automattic <developer.wordpress.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Token = require('./token')
  , nodes = require('./nodes')
  , errors = require('./errors');

/**
 * Operator aliases.
 */

var alias = {
  'and': '&&'
  , 'or': '||'
  , 'is': '=='
  , 'isnt': '!='
  , 'is not': '!='
  , ':=': '?='
};

exports = module.exports = class Lexer {
  /**
   * Initialize a new `Lexer` with the given `str` and `options`.
   *
   * @param {String} str
   * @param {Object} options
   * @api private
   */

  constructor(str, options) {
    options = options || {};
    this.stash = [];
    this.indentStack = [];
    this.indentRe = null;
    this.lineno = 1;
    this.column = 1;

    // HACK!
    function comment(str, val, offset, s) {
      var inComment = s.lastIndexOf('/*', offset) > s.lastIndexOf('*/', offset)
        , commentIdx = s.lastIndexOf('//', offset)
        , i = s.lastIndexOf('\n', offset)
        , double = 0
        , single = 0;

      if (~commentIdx && commentIdx > i) {
        while (i != offset) {
          if ("'" == s[i]) single ? single-- : single++;
          if ('"' == s[i]) double ? double-- : double++;

          if ('/' == s[i] && '/' == s[i + 1]) {
            inComment = !single && !double;
            break;
          }
          ++i;
        }
      }

      return inComment
        ? str
        : ((val === ',' && /^[,\t\n]+$/.test(str)) ? str.replace(/\n/, '\r') : val + '\r');
    };

    // Remove UTF-8 BOM.
    if ('\uFEFF' == str.charAt(0)) str = str.slice(1);

    this.str = str
      .replace(/\s+$/, '\n')
      .replace(/\r\n?/g, '\n')
      .replace(/\\ *\n/g, '\r')
      .replace(/([,(:](?!\/\/[^ ])) *(?:\/\/[^\n]*|\/\*.*?\*\/)?\n\s*/g, comment)
      .replace(/\s*\n[ \t]*([,)])/g, comment);
  };

  /**
     * Custom inspect.
     */

  inspect() {
    var tok
      , tmp = this.str
      , buf = [];
    while ('eos' != (tok = this.next()).type) {
      buf.push(tok.inspect());
    }
    this.str = tmp;
    return buf.concat(tok.inspect()).join('\n');
  }

  /**
   * Lookahead `n` tokens.
   *
   * @param {Number} n
   * @return {Object}
   * @api private
   */

  lookahead(n) {
    var fetch = n - this.stash.length;
    while (fetch-- > 0) this.stash.push(this.advance());
    return this.stash[--n];
  }

  /**
   * Consume the given `len`.
   *
   * @param {Number|Array} len
   * @api private
   */

  skip(len) {
    var chunk = len[0];
    len = chunk ? chunk.length : len;
    this.str = this.str.substr(len);
    if (chunk) {
      this.move(chunk);
    } else {
      this.column += len;
    }
  }

  /**
   * Move current line and column position.
   *
   * @param {String} str
   * @api private
   */

  move(str) {
    var lines = str.match(/\n/g)
      , idx = str.lastIndexOf('\n');

    if (lines) this.lineno += lines.length;
    this.column = ~idx
      ? str.length - idx
      : this.column + str.length;
  }

  /**
   * Fetch next token including those stashed by peek.
   *
   * @return {Token}
   * @api private
   */

  next() {
    var tok = this.stashed() || this.advance();
    this.prev = tok;
    return tok;
  }

  /**
   * Check if the current token is a part of selector.
   *
   * @return {Boolean}
   * @api private
   */

  isPartOfSelector() {
    var tok = this.stash[this.stash.length - 1] || this.prev;
    switch (tok && tok.type) {
      // #for
      case 'color':
        return 2 == tok.val.raw.length;
      // .or
      case '.':
      // [is]
      case '[':
        return true;
    }
    return false;
  }

  /**
   * Fetch next token.
   *
   * @return {Token}
   * @api private
   */

  advance() {
    var column = this.column
      , line = this.lineno
      , tok = this.eos()
        || this.null()
        || this.sep()
        || this.keyword()
        || this.urlchars()
        || this.comment()
        || this.newline()
        || this.escaped()
        || this.important()
        || this.literal()
        || this.anonFunc()
        || this.atrule()
        || this.function()
        || this.brace()
        || this.paren()
        || this.color()
        || this.string()
        || this.unit()
        || this.namedop()
        || this.boolean()
        || this.unicode()
        || this.ident()
        || this.op()
        || (function () {
          var token = this.eol();

          if (token) {
            column = token.column;
            line = token.lineno;
          }

          return token;
        }).call(this)
        || this.space()
        || this.selector();

    tok.lineno = line;
    tok.column = column;

    return tok;
  }

  /**
   * Lookahead a single token.
   *
   * @return {Token}
   * @api private
   */

  peek() {
    return this.lookahead(1);
  }

  /**
   * Return the next possibly stashed token.
   *
   * @return {Token}
   * @api private
   */

  stashed() {
    return this.stash.shift();
  }

  /**
   * EOS | trailing outdents.
   */

  eos() {
    if (this.str.length) return;
    if (this.indentStack.length) {
      this.indentStack.shift();
      return new Token('outdent');
    } else {
      return new Token('eos');
    }
  }

  /**
   * url char
   */

  urlchars() {
    var captures;
    if (!this.isURL) return;
    if (captures = /^\+[a-z]+/.exec(this.str) ? /^[\/:@.;?&+=*!,<>#%0-9]+/.exec(this.str) : /^[\/:@.;?&=*!,<>#%0-9]+/.exec(this.str)) {
      this.skip(captures);
      return new Token('literal', new nodes.Literal(captures[0]));
    }
  }

  /**
   * ';' [ \t]*
   */

  sep() {
    var captures;
    if (captures = /^;[ \t]*/.exec(this.str)) {
      this.skip(captures);
      return new Token(';');
    }
  }

  /**
   * '\r'
   */

  eol() {
    if ('\r' == this.str[0]) {
      ++this.lineno;
      this.skip(1);

      this.column = 1;
      while (this.space());

      return this.advance();
    }
  }

  /**
   * ' '+
   */

  space() {
    var captures;
    if (captures = /^([ \t]+)/.exec(this.str)) {
      this.skip(captures);
      return new Token('space');
    }
  }

  /**
   * '\\' . ' '*
   */

  escaped() {
    var captures;
    if (captures = /^\\(.)[ \t]*/.exec(this.str)) {
      var c = captures[1];
      this.skip(captures);
      return new Token('ident', new nodes.Literal(c));
    }
  }

  /**
   * '@css' ' '* '{' .* '}' ' '*
   */

  literal() {
    // HACK attack !!!
    var captures;
    if (captures = /^@css[ \t]*\{/.exec(this.str)) {
      this.skip(captures);
      var c
        , braces = 1
        , css = ''
        , node;
      while (c = this.str[0]) {
        this.str = this.str.substr(1);
        switch (c) {
          case '{': ++braces; break;
          case '}': --braces; break;
          case '\n':
          case '\r':
            ++this.lineno;
            break;
        }
        css += c;
        if (!braces) break;
      }
      css = css.replace(/\s*}$/, '');
      node = new nodes.Literal(css);
      node.css = true;
      return new Token('literal', node);
    }
  }

  /**
   * '!important' ' '*
   */

  important() {
    var captures;
    if (captures = /^!important[ \t]*/.exec(this.str)) {
      this.skip(captures);
      return new Token('ident', new nodes.Literal('!important'));
    }
  }

  /**
   * '{' | '}'
   */

  brace() {
    var captures;
    if (captures = /^([{}])/.exec(this.str)) {
      this.skip(1);
      var brace = captures[1];
      return new Token(brace, brace);
    }
  }

  /**
   * '(' | ')' ' '*
   */

  paren() {
    var captures;
    if (captures = /^([()])([ \t]*)/.exec(this.str)) {
      var paren = captures[1];
      this.skip(captures);
      if (')' == paren) this.isURL = false;
      var tok = new Token(paren, paren);
      tok.space = captures[2];
      return tok;
    }
  }

  /**
   * 'null'
   */

  null() {
    var captures
      , tok;
    if (captures = /^(null)\b[ \t]*/.exec(this.str)) {
      this.skip(captures);
      if (this.isPartOfSelector()) {
        tok = new Token('ident', new nodes.Ident(captures[0]));
      } else {
        tok = new Token('null', nodes.null);
      }
      return tok;
    }
  }

  /**
   *   'if'
   * | 'else'
   * | 'unless'
   * | 'return'
   * | 'for'
   * | 'in'
   */

  keyword() {
    var captures
      , tok;
    if (captures = /^(return|if|else|unless|for|in)\b(?!-)[ \t]*/.exec(this.str)) {
      var keyword = captures[1];
      this.skip(captures);
      if (this.isPartOfSelector()) {
        tok = new Token('ident', new nodes.Ident(captures[0]));
      } else {
        tok = new Token(keyword, keyword);
      }
      return tok;
    }
  }

  /**
   *   'not'
   * | 'and'
   * | 'or'
   * | 'is'
   * | 'is not'
   * | 'isnt'
   * | 'is a'
   * | 'is defined'
   */

  namedop() {
    var captures
      , tok;
    if (captures = /^(not|and|or|is a|is defined|isnt|is not|is)(?!-)\b([ \t]*)/.exec(this.str)) {
      var op = captures[1];
      this.skip(captures);
      if (this.isPartOfSelector()) {
        tok = new Token('ident', new nodes.Ident(captures[0]));
      } else {
        op = alias[op] || op;
        tok = new Token(op, op);
      }
      tok.space = captures[2];
      return tok;
    }
  }

  /**
   *   ','
   * | '+'
   * | '+='
   * | '-'
   * | '-='
   * | '*'
   * | '*='
   * | '/'
   * | '/='
   * | '%'
   * | '%='
   * | '**'
   * | '!'
   * | '&'
   * | '&&'
   * | '||'
   * | '>'
   * | '>='
   * | '<'
   * | '<='
   * | '='
   * | '=='
   * | '!='
   * | '!'
   * | '~'
   * | '?='
   * | ':='
   * | '?'
   * | ':'
   * | '['
   * | ']'
   * | '.'
   * | '..'
   * | '...'
   */

  op() {
    var captures;
    if (captures = /^([.]{1,3}|&&|\|\||[!<>=?:]=|\*\*|[-+*\/%]=?|[,=?:!~<>&\[\]])([ \t]*)/.exec(this.str)) {
      var op = captures[1];
      this.skip(captures);
      op = alias[op] || op;
      var tok = new Token(op, op);
      tok.space = captures[2];
      this.isURL = false;
      return tok;
    }
  }

  /**
   * '@('
   */

  anonFunc() {
    var tok;
    if ('@' == this.str[0] && '(' == this.str[1]) {
      this.skip(2);
      tok = new Token('function', new nodes.Ident('anonymous'));
      tok.anonymous = true;
      return tok;
    }
  }

  /**
   * '@' (-(\w+)-)?[a-zA-Z0-9-_]+
   */

  atrule() {
    var captures;
    if (captures = /^@(?!apply)(?:-(\w+)-)?([a-zA-Z0-9-_]+)[ \t]*/.exec(this.str)) {
      this.skip(captures);
      var vendor = captures[1]
        , type = captures[2]
        , tok;
      switch (type) {
        case 'require':
        case 'import':
        case 'charset':
        case 'namespace':
        case 'media':
        case 'scope':
        case 'supports':
          return new Token(type);
        case 'document':
          return new Token('-moz-document');
        case 'block':
          return new Token('atblock');
        case 'extend':
        case 'extends':
          return new Token('extend');
        case 'keyframes':
          return new Token(type, vendor);
        default:
          return new Token('atrule', (vendor ? '-' + vendor + '-' + type : type));
      }
    }
  }

  /**
   * '//' *
   */

  comment() {
    // Single line
    if ('/' == this.str[0] && '/' == this.str[1]) {
      var end = this.str.indexOf('\n');
      if (-1 == end) end = this.str.length;
      this.skip(end);
      return this.advance();
    }

    // Multi-line
    if ('/' == this.str[0] && '*' == this.str[1]) {
      var end = this.str.indexOf('*/');
      if (-1 == end) end = this.str.length;
      var str = this.str.substr(0, end + 2)
        , lines = str.split(/\n|\r/).length - 1
        , suppress = true
        , inline = false;
      this.lineno += lines;
      this.skip(end + 2);
      // output
      if ('!' == str[2]) {
        str = str.replace('*!', '*');
        suppress = false;
      }
      if (this.prev && ';' == this.prev.type) inline = true;
      return new Token('comment', new nodes.Comment(str, suppress, inline));
    }
  }

  /**
   * 'true' | 'false'
   */

  boolean() {
    var captures;
    if (captures = /^(true|false)\b([ \t]*)/.exec(this.str)) {
      var val = new nodes.Boolean('true' == captures[1]);
      this.skip(captures);
      var tok = new Token('boolean', val);
      tok.space = captures[2];
      return tok;
    }
  }

  /**
   * 'U+' [0-9A-Fa-f?]{1,6}(?:-[0-9A-Fa-f]{1,6})?
   */

  unicode() {
    var captures;
    if (captures = /^u\+[0-9a-f?]{1,6}(?:-[0-9a-f]{1,6})?/i.exec(this.str)) {
      this.skip(captures);
      return new Token('literal', new nodes.Literal(captures[0]));
    }
  }

  /**
   * -*[_a-zA-Z$] [-\w\d$]* '('
   */

  function() {
    var captures;
    if (captures = /^(-*[_a-zA-Z$][-\w\d$]*)\(([ \t]*)/.exec(this.str)) {
      var name = captures[1];
      this.skip(captures);
      this.isURL = 'url' == name;
      var tok = new Token('function', new nodes.Ident(name));
      tok.space = captures[2];
      return tok;
    }
  }

  /**
   * -*[_a-zA-Z$] [-\w\d$]*
   */

  ident() {
    var captures;
    if (captures = /^-*([_a-zA-Z$]|@apply)[-\w\d$]*/.exec(this.str)) {
      this.skip(captures);
      return new Token('ident', new nodes.Ident(captures[0]));
    }
  }

  /**
   * '\n' ' '+
   */

  newline() {
    var captures, re;

    // we have established the indentation regexp
    if (this.indentRe) {
      captures = this.indentRe.exec(this.str);
      // figure out if we are using tabs or spaces
    } else {
      // try tabs
      re = /^\n([\t]*)[ \t]*/;
      captures = re.exec(this.str);

      // nope, try spaces
      if (captures && !captures[1].length) {
        re = /^\n([ \t]*)/;
        captures = re.exec(this.str);
      }

      // established
      if (captures && captures[1].length) this.indentRe = re;
    }


    if (captures) {
      var tok
        , indents = captures[1].length;

      this.skip(captures);
      if (this.str[0] === ' ' || this.str[0] === '\t') {
        throw new errors.SyntaxError('Invalid indentation. You can use tabs or spaces to indent, but not both.');
      }

      // Blank line
      if ('\n' == this.str[0]) return this.advance();

      // Outdent
      if (this.indentStack.length && indents < this.indentStack[0]) {
        while (this.indentStack.length && this.indentStack[0] > indents) {
          this.stash.push(new Token('outdent'));
          this.indentStack.shift();
        }
        tok = this.stash.pop();
        // Indent
      } else if (indents && indents != this.indentStack[0]) {
        this.indentStack.unshift(indents);
        tok = new Token('indent');
        // Newline
      } else {
        tok = new Token('newline');
      }

      return tok;
    }
  }

  /**
   * '-'? (digit+ | digit* '.' digit+) unit
   */

  unit() {
    var captures;
    if (captures = /^(-)?(\d+\.\d+|\d+|\.\d+)(%|[a-zA-Z]+)?[ \t]*/.exec(this.str)) {
      this.skip(captures);
      var n = parseFloat(captures[2]);
      if ('-' == captures[1]) n = -n;
      var node = new nodes.Unit(n, captures[3]);
      node.raw = captures[0];
      return new Token('unit', node);
    }
  }

  /**
   * '"' [^"]+ '"' | "'"" [^']+ "'"
   */

  string() {
    var captures;
    if (captures = /^("[^"]*"|'[^']*')[ \t]*/.exec(this.str)) {
      var str = captures[1]
        , quote = captures[0][0];
      this.skip(captures);
      str = str.slice(1, -1).replace(/\\n/g, '\n');
      return new Token('string', new nodes.String(str, quote));
    }
  }

  /**
   * #rrggbbaa | #rrggbb | #rgba | #rgb | #nn | #n
   */

  color() {
    return this.rrggbbaa()
      || this.rrggbb()
      || this.rgba()
      || this.rgb()
      || this.nn()
      || this.n()
  }

  /**
   * #n
   */

  n() {
    var captures;
    if (captures = /^#([a-fA-F0-9]{1})[ \t]*/.exec(this.str)) {
      this.skip(captures);
      var n = parseInt(captures[1] + captures[1], 16)
        , color = new nodes.RGBA(n, n, n, 1);
      color.raw = captures[0];
      return new Token('color', color);
    }
  }

  /**
   * #nn
   */

  nn() {
    var captures;
    if (captures = /^#([a-fA-F0-9]{2})[ \t]*/.exec(this.str)) {
      this.skip(captures);
      var n = parseInt(captures[1], 16)
        , color = new nodes.RGBA(n, n, n, 1);
      color.raw = captures[0];
      return new Token('color', color);
    }
  }

  /**
   * #rgb
   */

  rgb() {
    var captures;
    if (captures = /^#([a-fA-F0-9]{3})[ \t]*/.exec(this.str)) {
      this.skip(captures);
      var rgb = captures[1]
        , r = parseInt(rgb[0] + rgb[0], 16)
        , g = parseInt(rgb[1] + rgb[1], 16)
        , b = parseInt(rgb[2] + rgb[2], 16)
        , color = new nodes.RGBA(r, g, b, 1);
      color.raw = captures[0];
      return new Token('color', color);
    }
  }

  /**
   * #rgba
   */

  rgba() {
    var captures;
    if (captures = /^#([a-fA-F0-9]{4})[ \t]*/.exec(this.str)) {
      this.skip(captures);
      var rgb = captures[1]
        , r = parseInt(rgb[0] + rgb[0], 16)
        , g = parseInt(rgb[1] + rgb[1], 16)
        , b = parseInt(rgb[2] + rgb[2], 16)
        , a = parseInt(rgb[3] + rgb[3], 16)
        , color = new nodes.RGBA(r, g, b, a / 255);
      color.raw = captures[0];
      return new Token('color', color);
    }
  }

  /**
   * #rrggbb
   */

  rrggbb() {
    var captures;
    if (captures = /^#([a-fA-F0-9]{6})[ \t]*/.exec(this.str)) {
      this.skip(captures);
      var rgb = captures[1]
        , r = parseInt(rgb.substr(0, 2), 16)
        , g = parseInt(rgb.substr(2, 2), 16)
        , b = parseInt(rgb.substr(4, 2), 16)
        , color = new nodes.RGBA(r, g, b, 1);
      color.raw = captures[0];
      return new Token('color', color);
    }
  }

  /**
   * #rrggbbaa
   */

  rrggbbaa() {
    var captures;
    if (captures = /^#([a-fA-F0-9]{8})[ \t]*/.exec(this.str)) {
      this.skip(captures);
      var rgb = captures[1]
        , r = parseInt(rgb.substr(0, 2), 16)
        , g = parseInt(rgb.substr(2, 2), 16)
        , b = parseInt(rgb.substr(4, 2), 16)
        , a = parseInt(rgb.substr(6, 2), 16)
        , color = new nodes.RGBA(r, g, b, a / 255);
      color.raw = captures[0];
      return new Token('color', color);
    }
  }

  /**
   * ^|[^\n,;]+
   */

  selector() {
    var captures;
    if (captures = /^\^|.*?(?=\/\/(?![^\[]*\])|[,\n{])/.exec(this.str)) {
      var selector = captures[0];
      this.skip(captures);
      return new Token('selector', selector);
    }
  }
};
