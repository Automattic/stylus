---
layout: default
permalink: docs/sourcemaps.html
---

# Sourcemaps

Stylus supports basic sourcemaps according to the [Sourcemap v3 spec](https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k)

## Create a sourcemap

Pass the `--sourcemap` flag (or `-m`) with a Stylus file. This will create a `style.css` file, and a `style.css.map` file as siblings to your `style.styl` and place a sourcemap link at the bottom of `style.css` to your sourcemap.

```bash
stylus -m style.styl
```

You can also run this command while watching a file. For instance: `stylus -w -m style.styl`. This will update your sourcemap everytime you save.

## JavaScript API

Set the `sourcemap` setting with an options object or a boolean value:

```js
var stylus = require('stylus');

var style = stylus(str)
  .set('filename', 'file.styl')
  .set('sourcemap', options);

style.render(function(err, css) {
  // generated sourcemap object
  console.log(style.sourcemap);
});
```

### Options

```bash
`comment`     Adds a comment with the `sourceMappingURL` to the generated CSS (default: `true`)
`inline`      Inlines the sourcemap into the generated CSS in base64 format (default: `false`)
`sourceRoot`  "sourceRoot" property of the generated sourcemap
`basePath`    Base path from which sourcemap and all sources are relative (default: `.`)
`embedSource` Embed the full source text into the sourcemap (defaut: `false`)
```
