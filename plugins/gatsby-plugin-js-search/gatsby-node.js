'use strict';

const {writeFileSync} = require('fs');
const {XmlEntities} = require('html-entities');
const {join} = require('path');
//const removeMarkdown = require('remove-markdown');
const sanitizeHtml = require('sanitize-html');
const stemmer = require('stemmer');
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
    const uniqueWordsMap = {};
    const searchTermToTopResults = [];
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
            .replace(/^[~`!@#$%^&*(){}\[\];:"'<,.>?\/\\|_+=-]/g, '')
            .replace(/[~`!@#$%^&*(){}\[\];:"'<,.>?\/\\|_+=-]$/g, '');

          // Stem and lower case (eg "Considerations" -> "consider")
          token = stemmer(token.toLocaleLowerCase());

          return token;
        })
        .filter(Boolean); // Remove empty tokens

      // Next, using the filtered and mapped word-set,
      // Index each document to determine the TF-IDF ranking for its words.
      text.forEach(token => {
        uniqueWordsMap[token] = true; // Make sure we're tracking each unique word for later

        // TODO generate prefix strings

        index.indexDocument(token, uid);
      });

      // Lastly iterate all unique search terms,
      // Pre-determine the top N results,
      // And write to an optimized map.
      Object.keys(uniqueWordsMap).forEach(word => {
        const results = index.search([word]).slice(0, 5); // TODO Don't hard-code 5?

        searchTermToTopResults.push(`${word} ${results.join(' ')}`);
      });
    });

    writeFileSync(
      join(__dirname, '../../public/search.documents'),
      documentIdMappings.join('\n'),
    );

    writeFileSync(
      join(__dirname, '../../public/search.results'),
      searchTermToTopResults.join('\n'),
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

// Lifted from js-search
class SearchIndex {
  constructor() {
    this._documentCount = 0;
    this._tokenToIdfCache = Object.create(null);
    this._tokenMap = Object.create(null);
  }

  /**
   * @inheritDocs
   */
  indexDocument(token, uid) {
    this._tokenToIdfCache = Object.create(null); // New index invalidates previous IDF caches
    this._documentCount++;

    var tokenMap = this._tokenMap;
    var tokenDatum;

    if (typeof tokenMap[token] !== 'object') {
      tokenMap[token] = tokenDatum = {
        $numDocumentOccurrences: 0,
        $totalNumOccurrences: 1,
        $uidMap: Object.create(null),
      };
    } else {
      tokenDatum = tokenMap[token];
      tokenDatum.$totalNumOccurrences++;
    }

    var uidMap = tokenDatum.$uidMap;

    if (typeof uidMap[uid] !== 'object') {
      tokenDatum.$numDocumentOccurrences++;
      uidMap[uid] = {
        $numTokenOccurrences: 1,
      };
    } else {
      uidMap[uid].$numTokenOccurrences++;
    }
  }

  /**
   * @inheritDocs
   */
  search(tokens) {
    var uidToDocumentMap = Object.create(null);

    for (var i = 0, numTokens = tokens.length; i < numTokens; i++) {
      var token = tokens[i];
      var tokenMetadata = this._tokenMap[token];

      // Short circuit if no matches were found for any given token.
      if (!tokenMetadata) {
        return [];
      }

      if (i === 0) {
        var keys = Object.keys(tokenMetadata.$uidMap);
        for (var j = 0, numKeys = keys.length; j < numKeys; j++) {
          var uid = keys[j];

          uidToDocumentMap[uid] = tokenMetadata.$uidMap[uid].$document;
        }
      } else {
        var keys = Object.keys(uidToDocumentMap);
        for (var j = 0, numKeys = keys.length; j < numKeys; j++) {
          var uid = keys[j];

          if (typeof tokenMetadata.$uidMap[uid] !== 'object') {
            delete uidToDocumentMap[uid];
          }
        }
      }
    }

    var documents = [];

    for (var uid in uidToDocumentMap) {
      documents.push(uid);
    }

    var calculateTfIdf = this._createCalculateTfIdf();

    // Return documents sorted by TF-IDF
    return documents.sort(
      (uidA, uidB) =>
        calculateTfIdf(tokens, uidB) - calculateTfIdf(tokens, uidA),
    );
  }

  _createCalculateIdf() {
    var tokenMap = this._tokenMap;
    var tokenToIdfCache = this._tokenToIdfCache;

    return token => {
      if (!tokenToIdfCache[token]) {
        var numDocumentsWithToken =
          typeof tokenMap[token] !== 'undefined'
            ? tokenMap[token].$numDocumentOccurrences
            : 0;

        tokenToIdfCache[token] =
          1 + Math.log(this._documentCount / (1 + numDocumentsWithToken));
      }

      return tokenToIdfCache[token];
    };
  }

  _createCalculateTfIdf() {
    var tokenMap = this._tokenMap;
    var calculateIdf = this._createCalculateIdf();

    return (tokens, uid) => {
      var score = 0;

      for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
        var token = tokens[i];

        var inverseDocumentFrequency = calculateIdf(token);

        if (inverseDocumentFrequency === Infinity) {
          inverseDocumentFrequency = 0;
        }

        var termFrequency =
          typeof tokenMap[token] !== 'undefined' &&
          typeof tokenMap[token].$uidMap[uid] !== 'undefined'
            ? tokenMap[token].$uidMap[uid].$numTokenOccurrences
            : 0;

        score += termFrequency * inverseDocumentFrequency;
      }

      return score;
    };
  }
}
