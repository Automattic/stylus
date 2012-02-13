/*!
 * Stylus - middleware
 * Copyright(c) 2010 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var stylus = require('./stylus')
  , fs = require('fs')
  , url = require('url')
  , basename = require('path').basename
  , dirname = require('path').dirname
  , mkdirp = require('mkdirp')
  , join = require('path').join;

/**
 * Import map.
 */

var imports = {};

/**
 * Return Connect middleware with the given `options`.
 *
 * Options:
 *
 *    `force`     Always re-compile
 *    `debug`     Output debugging information
 *    `src`       Source directory used to find .styl files
 *    `dest`      Destination directory used to output .css files
 *                when undefined defaults to `src`.
 *    `compile`   Custom compile function, accepting the arguments
 *                `(str, path)`.
 *    `compress`  Whether the output .css files should be compressed
 *    `firebug`   Emits debug infos in the generated css that can
 *                be used by the FireStylus Firebug plugin
 *    `linenos`   Emits comments in the generated css indicating 
 *                the corresponding stylus line
 *
 * Examples:
 * 
 * Here we set up the custom compile function so that we may
 * set the `compress` option, or define additional functions.
 * 
 * By default the compile function simply sets the `filename`
 * and renders the CSS.
 * 
 *      function compile(str, path) {
 *        return stylus(str)
 *          .set('filename', path)
 *          .set('compress', true);
 *      }
 * 
 * Pass the middleware to Connect, grabbing .styl files from this directory
 * and saving .css files to _./public_. Also supplying our custom `compile` function.
 * 
 * Following that we have a `staticProvider` layer setup to serve the .css
 * files generated by Stylus.
 * 
 *      var server = connect.createServer(
 *          stylus.middleware({
 *              src: __dirname
 *            , dest: __dirname + '/public'
 *            , compile: compile
 *          })
 *        , connect.static(__dirname + '/public')
 *      );
 * 
 * @param {Object} options
 * @return {Function}
 * @api public
 */

module.exports = function(options){
  options = options || {};

  // Accept src/dest dir
  if ('string' == typeof options) {
    options = { src: options };
  }

  // Force compilation
  var force = options.force;

  // Debug option
  var debug = options.debug;

  // Source dir required
  var src = options.src;
  if (!src) throw new Error('stylus.middleware() requires "src" directory');

  // Default dest dir to source
  var dest = options.dest
    ? options.dest
    : src;

  // Default compile callback
  options.compile = options.compile || function(str, path){
    return stylus(str)
      .set('filename', path)
      .set('compress', options.compress)
      .set('firebug', options.firebug)
      .set('linenos', options.linenos);
  };

  // Middleware
  return function stylus(req, res, next){
    if ('GET' != req.method && 'HEAD' != req.method) return next();
    var path = url.parse(req.url).pathname;
    if (/\.css$/.test(path)) {
      var cssPath = join(dest, path)
        , stylusPath = join(src, path.replace('.css', '.styl'));

      if (debug) {
        log('source', stylusPath);
        log('dest', cssPath);
      }

      // Ignore ENOENT to fall through as 404
      function error(err) {
        next('ENOENT' == err.code
          ? null
          : err);
      }

      // Force
      if (force) return compile();

      // Compile to cssPath
      function compile() {
        if (debug) log('read', cssPath);
        fs.readFile(stylusPath, 'utf8', function(err, str){
          if (err) return error(err);
          var style = options.compile(str, stylusPath);
          var paths = style.options._imports = [];
          delete imports[stylusPath];
          style.render(function(err, css){
            if (err) return next(err);
            if (debug) log('render', stylusPath);
            imports[stylusPath] = paths;
            mkdirp(dirname(cssPath), 0700, function(err){
              if (err) return error(err);
              fs.writeFile(cssPath, css, 'utf8', next);
            });
          });
        });
      }

      // Re-compile on server restart, disregarding
      // mtimes since we need to map imports
      if (!imports[stylusPath]) return compile();

      // Compare mtimes
      fs.stat(stylusPath, function(err, stylusStats){
        if (err) return error(err);
        fs.stat(cssPath, function(err, cssStats){
          // CSS has not been compiled, compile it!
          if (err) {
            if ('ENOENT' == err.code) {
              if (debug) log('not found', cssPath);
              compile();
            } else {
              next(err);
            }
          } else {
            // Source has changed, compile it
            if (stylusStats.mtime > cssStats.mtime) {
              if (debug) log('modified', cssPath);
              compile();
            // Already compiled, check imports
            } else {
              checkImports(stylusPath, function(changed){
                if (debug && changed.length) {
                  changed.forEach(function(path) {
                    log('modified import %s', path);
                  });
                }
                changed.length ? compile() : next();
              });
            }
          }
        });
      });
    } else {
      next();
    }
  }
};

/**
 * Check `path`'s imports to see if they have been altered.
 *
 * @param {String} path
 * @param {Function} fn
 * @api private
 */

function checkImports(path, fn) {
  var nodes = imports[path];
  if (!nodes) return fn();
  if (!nodes.length) return fn();

  var pending = nodes.length
    , changed = [];

  nodes.forEach(function(imported){
    fs.stat(imported.path, function(err, stat){
      // error or newer mtime
      if (err || !imported.mtime || stat.mtime > imported.mtime) {
        changed.push(imported.path);
      }
      --pending || fn(changed);
    });
  });
}

/**
 * Log a message.
 *
 * @api private
 */

function log(key, val) {
  console.error('  \033[90m%s :\033[0m \033[36m%s\033[0m', key, val);
}