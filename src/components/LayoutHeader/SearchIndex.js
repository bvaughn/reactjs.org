/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * @emails react-core
 */

import stemmer from 'stemmer';

import documents from 'raw!../../../public/search.documents';
import serializedIndex from 'raw!../../../public/search.index';

// TODO Change load() to be incremental,
// Enabling the index to be broken into pieces based on starting letter.
// Then we can lazily load only the ones we needed.

class SearchIndex {
  constructor() {
    this._documentCount = 0;
    this._tokenToIdfCache = Object.create(null);
    this._tokenMap = Object.create(null);
  }

  serialize() {
    const tokenMap = this._tokenMap;
    const tokens = Object.keys(tokenMap)
      .map(token => `${token}\t${Object.keys(tokenMap[token]).join(',')}`);

    return `${this._documentCount}\n${tokens}`;
  }

  load(text) {
    const lines = text.split('\n');

    this._documentCount = lines.shift();
    this._tokenMap = lines.reduce((reduced, line) => {
      const [token, uids] = line.split('\t');
      const uidMap = Object.create(null);
      uids.split(',').forEach(uid => {
        uidMap[uid] = true;
      })
      reduced[token] = uidMap;
      return reduced;
    }, Object.create(null));
  }

  /**
   * @inheritDocs
   */
  search(tokens) {
    var uidToDocumentMap = Object.create(null);

    for (let i = 0, numTokens = tokens.length; i < numTokens; i++) {
      let token = tokens[i];
      let tokenMetadata = this._tokenMap[token];

      // Short circuit if no matches were found for any given token.
      if (!tokenMetadata) {
        return [];
      }

      if (i === 0) {
        let keys = Object.keys(tokenMetadata);
        for (let j = 0, numKeys = keys.length; j < numKeys; j++) {
          let uid = keys[j];

          uidToDocumentMap[uid] = uid;
        }
      } else {
        let keys = Object.keys(uidToDocumentMap);
        for (let j = 0, numKeys = keys.length; j < numKeys; j++) {
          let uid = keys[j];

          if (tokenMetadata[uid] == null) {
            delete uidToDocumentMap[uid];
          }
        }
      }
    }

    const documents = Object.keys(uidToDocumentMap);

    let calculateTfIdf = this._createCalculateTfIdf();

    // Return documents sorted by TF-IDF
    return documents.sort(
      (uidA, uidB) =>
        calculateTfIdf(tokens, uidB) - calculateTfIdf(tokens, uidA),
    );
  }

  _createCalculateIdf() {
    const tokenMap = this._tokenMap;
    const tokenToIdfCache = this._tokenToIdfCache;

    return token => {
      if (!tokenToIdfCache[token]) {
        const numDocumentsWithToken =
          typeof tokenMap[token] !== 'undefined' ? tokenMap[token].n : 0;

        tokenToIdfCache[token] =
          1 + Math.log(this._documentCount / (1 + numDocumentsWithToken));
      }

      return tokenToIdfCache[token];
    };
  }

  _createCalculateTfIdf() {
    const tokenMap = this._tokenMap;
    const calculateIdf = this._createCalculateIdf();

    return (tokens, uid) => {
      let score = 0;

      for (let i = 0, numTokens = tokens.length; i < numTokens; ++i) {
        let token = tokens[i];
        let inverseDocumentFrequency = calculateIdf(token);

        if (inverseDocumentFrequency === Infinity) {
          inverseDocumentFrequency = 0;
        }

        let termFrequency =
          typeof tokenMap[token] !== 'undefined' &&
          typeof tokenMap[token][uid] !== 'undefined'
            ? tokenMap[token][uid]
            : 0;

        score += termFrequency * inverseDocumentFrequency;
      }

      return score;
    };
  }
}

const documentsMap = Object.create(null);
documents.split('\n').forEach(line => {
  const [uid, slug, title] = line.split('\t');

  documentsMap[uid] = {slug, title};
});

const searchIndex = new SearchIndex();
searchIndex.load(serializedIndex);

window.searchIndex = searchIndex; // TESTING

const search = text => {
  text = text
    .split(/\s/)
    .map(token => stemmer(token.toLocaleLowerCase()))
    .filter(Boolean);

  return searchIndex.search(text).map(uid => documentsMap[uid]);
};

module.exports = {
  search,
};
