---
layout: compress
# WARNING: Don't use '//' to comment out code, use '{% comment %}' and '{% endcomment %}' instead.
---

{%- comment -%}
  See: <https://docs.mathjax.org/en/latest/options/input/tex.html#tex-options>
{%- endcomment -%}

MathJax = {
  tex: {
    {%- comment -%} start/end delimiter pairs for in-line math {%- endcomment -%}
    inlineMath: [
      ['$', '$'],
      ['\\(', '\\)']
    ],
    {%- comment -%} start/end delimiter pairs for display math {%- endcomment -%}
    displayMath: [
      ['$$', '$$'],
      ['\\[', '\\]']
    ],
    {%- comment -%} equation numbering {%- endcomment -%}
    tags: 'ams'
  },
  {%- comment -%}
    Site override of the theme's config (only addition): when a display
    equation is wider than its container (e.g. on a phone), MathJax 4
    wraps it at a top-level break point (commas, \quad, operators)
    instead of overflowing and widening the whole page. Equations that
    fit stay on one line, so desktop rendering is unchanged.
    See: <https://docs.mathjax.org/en/latest/output/linebreaks.html>
  {%- endcomment -%}
  output: {
    displayOverflow: 'linebreak'
  }
};
