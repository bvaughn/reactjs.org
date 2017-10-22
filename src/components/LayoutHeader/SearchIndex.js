/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * @emails react-core
 */

import SearchApi, { INDEX_MODES } from 'js-worker-search';
import data from 'raw!../../../public/search.index';

const searchApi = new SearchApi({
  indexMode: INDEX_MODES.PREFIXES
});

data.split('\n').forEach(line => {
  const index = line.indexOf('\t');
  const slug = line.substr(0, index);
  const words = line.substr(index + 1);

  searchApi.indexDocument(slug, words);
});

module.exports = searchApi;