'use strict';

const {writeFileSync} = require('fs');
const {XmlEntities} = require('html-entities');
const {join} = require('path');
const sanitizeHtml = require('sanitize-html');
const StopWords = require('./stop-words');

const entities = new XmlEntities();

const removePreTags = text => {
  while (true) {
    let openTagIndex = text.indexOf('<pre');

    if (openTagIndex < 0) {
      return text;
    }

    let closeTagIndex = text.indexOf('</pre', openTagIndex);

    text = text.substr(0, openTagIndex) + text.substr(closeTagIndex + 5);
  }
};

exports.createPages = async ({graphql, boundActionCreators}) => {
  try {
    const {createNode} = boundActionCreators;

    const result = await graphql(query);

    if (result.errors) {
      throw new Error(result.errors.join(`, `));
    }

    const documentIdMappings = [];
    const serializedIndex = null;
    const index = new SearchIndex();

    result.data.allMarkdownRemark.edges.forEach(({node}, uid) => {
      const html = node.html;
      const slug = node.fields.slug;
      const title = node.frontmatter.title;

      documentIdMappings.push(`${uid}\t${slug}\t${title}`);

      let text = html;

      // First sanitize the content.
      // Remove inline code examples (eg <pre>...</pre>)
      text = removePreTags(text);

      // Remove HTML tags (eg formatting like bold, italics)
      text = sanitizeHtml(text, {
        allowedTags: [],
        allowedAttributes: [],
        parser: {
          decodeEntities: true,
        },
      });

      // Next, split the sentences into tokens (words),
      // Filter out stop-words (eg a, an, the),
      // Remove leading and trailing punctuation,
      // And convert HTML entities to human-friendly text (eg "&amp;" -> "&").
      // Stem and lower case the remaining words (eg "Considerations" -> "consider").
      text = text
        .split(/\s+/) // Split words at boundaries
        .map(token => {
          token = token.toLocaleLowerCase(); // Normalize by lowercasing

          if (StopWords[token] !== undefined) {
            return; // Bail early on stop-words
          }

          token = entities.decode(token); // Decode HTML entities (eg "&nbsp;" => "&")

          // Strip dangling punctuation
          token = token
            .replace(/^[~`!@#$%^&*(){}\[\];:“"'<,.>?\/\\|_+=-]+/g, '')
            .replace(/[~`!@#$%^&*(){}\[\];:“"'<,.>?\/\\|_+=-]+$/g, '');

          // Stem and lower case (eg "Considerations" -> "consider")
          token = token.toLocaleLowerCase();

          return token;
        })
        .filter(Boolean); // Remove empty tokens

      // Next, using the filtered and mapped word-set,
      // Index each document to determine the TF-IDF ranking for its words.
      text.forEach(token => {
        // Make sure we're index each unique substring for more natural runtime search
        for (let i = 1; i < token.length; i++) {
          const substring = token.substr(0, i);

          index.indexDocument(substring, uid);
        }
      });
    });

    writeFileSync(
      join(__dirname, '../../public/search.documents'),
      documentIdMappings.join('\n'),
    );

    writeFileSync(
      join(__dirname, '../../public/search.index'),
      index.serialize(),
    );
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const query = `
  {
    allMarkdownRemark {
      edges {
        node {
          html
          fields {
            slug
          }
          frontmatter {
            title
          }
          internal {
            content
          }
        }
      }
    }
  }
`;

// Adapted from js-search
class SearchIndex {
  constructor() {
    this._documentCount = 0;
    this._tokenMap = Object.create(null);
  }

  serialize() {
    const tokenMap = this._tokenMap;
    const tokens = Object.keys(tokenMap)
      .map(token => `${token}\t${Object.keys(tokenMap[token]).join(',')}`);

    return `${this._documentCount}\n${tokens.join('\n')}`;
  }

  /**
   * @inheritDocs
   */
  indexDocument(token, uid) {
    this._documentCount++;

    var tokenMap = this._tokenMap;
    var tokenDatum;

    if (typeof tokenMap[token] !== 'object') {
      tokenDatum = tokenMap[token] = Object.create(null);
    } else {
      tokenDatum = tokenMap[token];
    }

    tokenDatum[uid] = true;
  }
}
