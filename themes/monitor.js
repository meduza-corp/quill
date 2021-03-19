import extend from 'extend';
import Emitter from '../core/emitter';
import BaseTheme, { BaseTooltip } from './base';
import { Range } from '../core/selection';
import icons from '../ui/icons';
import axios from 'axios';


const TOOLBAR_CONFIG = [
  ['bold', 'italic', 'link'],
  [{ header: 1 }, { header: 2 }, 'blockquote']
];

class MonitorTheme extends BaseTheme {
  constructor(quill, options) {
    if (options.modules.toolbar != null && options.modules.toolbar.container == null) {
      options.modules.toolbar.container = TOOLBAR_CONFIG;
    }
    super(quill, options);
    this.quill.container.classList.add('ql-bubble');
  }

  extendToolbar(toolbar) {
    this.tooltip = new MonitorTooltip(this.quill, this.options.bounds);
    this.tooltip.root.appendChild(toolbar.container);
    this.buildButtons([].slice.call(toolbar.container.querySelectorAll('button')), icons);
    this.buildPickers([].slice.call(toolbar.container.querySelectorAll('select')), icons);
  }
}
MonitorTheme.DEFAULTS = extend(true, {}, BaseTheme.DEFAULTS, {
  modules: {
    toolbar: {
      handlers: {
        link: function() {
          let range = this.quill.getSelection();
          const format = this.quill.getFormat(range);
          this.quill.theme.tooltip.edit('link', format.link);
        },
        spotlight: function() {
          let range = this.quill.getSelection();
          const format = this.quill.getFormat(range);
          this.quill.theme.tooltip.edit('spotlight', format.spotlight);
        }
      }
    },
    keyboard: {
      bindings: {
        custom: {
          key: 'L',
          shiftKey: true,
          metaKey: true,
          handler: function() {
            this.quill.theme.modules.toolbar.handlers.link.apply(this);
          }
        }
      }
    }
  }
});


class MonitorTooltip extends BaseTooltip {
  constructor(quill, bounds) {
    super(quill, bounds);
    this.quill.on(Emitter.events.EDITOR_CHANGE, (type, range, oldRange, source) => {
      if (type !== Emitter.events.SELECTION_CHANGE) return;
      if (range != null && range.length > 0 && source === Emitter.sources.USER) {
        this.show();
        // Lock our width so we will expand beyond our offsetParent boundaries
        this.root.style.left = '0px';
        this.root.style.width = '';
        this.root.style.width = this.root.offsetWidth + 'px';
        let lines = this.quill.getLines(range.index, range.length);
        if (lines.length === 1) {
          this.position(this.quill.getBounds(range));
        } else {
          let lastLine = lines[lines.length - 1];
          let index = this.quill.getIndex(lastLine);
          let length = Math.min(lastLine.length() - 1, range.index + range.length - index);
          let bounds = this.quill.getBounds(new Range(index, length));
          this.position(bounds);
        }
      } else if (document.activeElement !== this.textbox && this.quill.hasFocus()) {
        this.hide();
      }
    });
  }

  listen() {
    super.listen();
    this.root.querySelector('.ql-close').addEventListener('click', () => {
      this.root.classList.remove('ql-editing');
    });
    this.root.querySelector('.ql-shorten').addEventListener('click', () => {
      const input = this.root.querySelector('.ql-tooltip-editor input');
      const shortenButton = this.root.querySelector('.ql-tooltip-editor .ql-shorten');

      if (!shortenButton.classList.contains('loading')) {
        shortenButton.classList.add('loading');
        axios
          .get(this.quill.options.modules.toolbar.shortenUrl, { params: { url: input.value } })
          .then((response) => {
            shortenButton.classList.remove('loading');
            input.value = response.data.url;
            input.focus();
          })
          // .catch((_err) => {
          //   shortenButton.classList.remove('loading');
          // });
      }
    });
    this.quill.on(Emitter.events.SCROLL_OPTIMIZE, () => {
      // Let selection be restored by toolbar handlers before repositioning
      setTimeout(() => {
        if (this.root.classList.contains('ql-hidden')) return;
        let range = this.quill.getSelection();
        if (range != null) {
          this.position(this.quill.getBounds(range));
        }
      }, 1);
    });
  }

  edit(mode = 'link', preview = null) {
    this.root.classList.remove('ql-hidden');
    this.root.classList.add('ql-editing');

    if (mode === 'link') {
      if (preview != null) {
        this.textbox.value = preview;
      } else if (mode !== this.root.getAttribute('data-mode')) {
        this.textbox.value = '';
      }
    }

    if (mode === 'spotlight') {
      if (preview != null) {
        this.textbox.value = preview.comment;
      } else if (mode !== this.root.getAttribute('data-mode')) {
        this.textbox.value = '';
      }
    }

    this.position(this.quill.getBounds(this.quill.selection.savedRange));
    this.textbox.select();

    if (mode === 'link') {
      this.textbox.setAttribute('placeholder', 'https://meduza.io/...');
    }

    if (mode === 'spotlight') {
      console.log(this) // eslint-disable-line no-console
      this.textbox.setAttribute('placeholder', 'Оставить комментарий...');
    }

    this.root.setAttribute('data-mode', mode);
  }

  cancel() {
    this.show();
  }

  position(reference) {
    let shift = super.position(reference);
    let arrow = this.root.querySelector('.ql-tooltip-arrow');
    arrow.style.marginLeft = '';
    if (shift === 0) return shift;
    arrow.style.marginLeft = (-1*shift - arrow.offsetWidth/2) + 'px';
  }
}
MonitorTooltip.TEMPLATE = [
  '<span class="ql-tooltip-arrow"></span>',
  '<div class="ql-tooltip-editor">',
    '<input type="text" data-formula="e=mc^2" data-link="https://quilljs.com" data-video="Embed URL">',
    '<a class="ql-shorten"></a>',
    '<a class="ql-close"></a>',
  '</div>'
].join('');


export { MonitorTooltip, MonitorTheme as default };
