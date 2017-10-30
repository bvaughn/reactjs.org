'use strict';

const {writeFileSync} = require('fs');
const {XmlEntities} = require('html-entities');
const {join} = require('path');
const removeMarkdown = require('remove-markdown');
const sanitizeHtml = require('sanitize-html');
const stemmer = require('stemmer');
const StopWords = require('./stop-words');

const entities = new XmlEntities();

const TOKENIZER_REGEX = /[\s]+/g;

function sanitize(text) {
  return sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: [],
    parser: {
      decodeEntities: true
    }
  })
  .split(/[\s]+/g)
  .map(token => 
    entities.decode(token)
      .replace(/^[~`!@#$%^&*(){}\[\];:"'<,.>?\/\\|_+=-]/g, '')
      .replace(/[~`!@#$%^&*(){}\[\];:"'<,.>?\/\\|_+=-]$/g, '')
  )
  .join(' ');
}

function tokenize(text) {
  const uniqueWords = {};

  return text
    .split(TOKENIZER_REGEX) // Split words at boundaries
    .filter(word => {
      // Remove empty tokens and stop-words
      return word != '' && StopWords[word] === undefined;
    })
    .map(token => {
      // Strip HTML entities
      token = entities.decode(token);

      // Strip dangling punctuation
      token = token
        .replace(/^[~`!@#$%^&*(){}\[\];:"'<,.>?\/\\|_+=-]/g, '')
        .replace(/[~`!@#$%^&*(){}\[\];:"'<,.>?\/\\|_+=-]$/g, '');

      // Stem and lower case (eg "Considerations" -> "consider")
      token = stemmer(token.toLocaleLowerCase());

      return token;
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

const rawData = [];
  result.data.allMarkdownRemark.edges.forEach(edge => {
    const content = edge.node.internal.content;
    const html = edge.node.html;
    const slug = edge.node.fields.slug;
    const title = edge.node.frontmatter.title;

    // Strip all HTML markup from searchable content
    let text = content.replace(/(```)[^(```)]+(```)/g, '');
    text = removeMarkdown(text)
    text = sanitize(text, {
      allowedTags: [],
      allowedAttributes: []
    });
rawData.push(`${slug}\t${title}\t${sanitize(text)}`)

    const index = tokenize(`${text} ${title}`).join(' ');

    searchData.push(`${slug}\t${title}\t${index}`);
  });
writeFileSync(join(__dirname, '../../public/search.raw'), rawData.join('\n'));

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
