'use strict';

const {writeFileSync} = require('fs');
const lunr = require('lunr');
const {join} = require('path');
const sanitize = require('sanitize-html');

/* TODO Tap into :onCreatePage too for non-markdown pages?
exports.onCreatePage = async ({ page, boundActionCreators }) => {
  console.log('onCreatePage()', page);
}
*/

exports.createPages = async ({ graphql, boundActionCreators }) => {
  const result = await graphql(query)

  if (result.errors) {
    throw new Error(result.errors.join(`, `))
  }

  const pages = [];

  result.data.allMarkdownRemark.edges.forEach(edge => {
    const html = edge.node.html;
    const slug = edge.node.fields.slug;
    const title = edge.node.frontmatter.title;

    // Strip all HTML markup from searchable content
    const text = sanitize(html, {
      allowedTags: false,
      allowedAttributes: false
    });

    pages.push({
      id: slug,
      text,
      title,
    });
  });

  // Pre-generate Lunr search index
  const index = lunr(function() {
    this.field('text');
    this.field('title');

    pages.forEach(page => {
      this.add(page);
    });
  });

  const path = join(__dirname, '../../public/search.index');
  const data = JSON.stringify(index.toJSON());

  writeFileSync(path, data);
};

/* TODO Use this hook if we end up using :onCreatePage too
exports.onPostBuild = () => {
  console.log('Copying locales');
  fs.copySync(path.join(__dirname, '/src/locales'), path.join(__dirname, '/public/locales'));
}
*/

const query = `
  {
    allMarkdownRemark {
      edges {
        node {
          html
          frontmatter {
            title
          }
          fields {
            slug
          }
        }
      }
    }
  }
`;