'use strict';

const {writeFileSync} = require('fs');
const {join} = require('path');
const sanitize = require('sanitize-html');
const stemmer = require('stemmer');
const StopWords = require('./stop-words');

const TOKENIZER_REGEX = /[^a-zа-яё0-9\-\.']+/i;

function tokenize(text) {
  const uniqueWords = {};

  return text
    .split(TOKENIZER_REGEX) // Split words at boundaries
    .filter(word => {
      // Remove empty tokens and stop-words
      return word != '' && StopWords[word] === undefined;
    })
    .map(word => {
      // Stem and lower case (eg "Considerations" -> "consider")
      return stemmer(word.toLocaleLowerCase());
    })
    .filter(word => {
      // Remove duplicates so serialized format is smaller
      // This means we can't later use TF-IDF ranking but maybe that's ok?
      // If we decide later to use it let's pre-generate its metadata also.
      if (uniqueWords[word] === undefined) {
        uniqueWords[word] = true;
        return true;
      }
    });
}

exports.createPages = async ({graphql, boundActionCreators}) => {
  const {createNode} = boundActionCreators;

  const result = await graphql(query);

  if (result.errors) {
    throw new Error(result.errors.join(`, `));
  }

  const searchData = [];

  result.data.allMarkdownRemark.edges.forEach(edge => {
    const html = edge.node.html;
    const slug = edge.node.fields.slug;
    const title = edge.node.frontmatter.title;

    // Strip all HTML markup from searchable content
    const text = sanitize(html, {
      allowedTags: false,
      allowedAttributes: false,
    });

    const index = tokenize(`${text} ${title}`).join(' ');

    searchData.push(`${slug}\t${index}`);
  });

  const path = join(__dirname, '../../public/search.index');
  const data = searchData.join('\n');

  writeFileSync(path, data);
};

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
