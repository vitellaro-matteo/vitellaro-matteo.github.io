import { defineHastPlugin } from 'satteri';
import { url } from './paths';

const attributeByTag: Record<string, string> = { a: 'href', img: 'src' };

/**
 * Routes root-relative links and images written in Markdown/MDX bodies through
 * the base path, so authors write `/journal/…` and it works under any base.
 */
export const basePathPlugin = defineHastPlugin({
  name: 'base-path',
  element: {
    filter: Object.keys(attributeByTag),
    visit(node, ctx) {
      const attribute = attributeByTag[node.tagName];
      const value = attribute ? node.properties[attribute] : undefined;
      if (attribute && typeof value === 'string') {
        ctx.setProperty(node, attribute, url(value));
      }
    },
  },
});
