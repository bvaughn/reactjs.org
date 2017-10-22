/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * @emails react-core
 */

import SearchApi, {INDEX_MODES} from 'js-worker-search';
import data from 'raw!../../../public/search.index';

const searchApi = new SearchApi({
  indexMode: INDEX_MODES.PREFIXES,
});

const slugToTitleMap = {};

data.split('\n').forEach(line => {
  const [slug, title, words] = line.split('\t');

  slugToTitleMap[slug] = title;

  searchApi.indexDocument(slug, words);
});

const mapResult = slug => ({
  slug,
  title: slugToTitleMap[slug],
});

const filterResults = results => results.slice(0, 5).map(mapResult);

module.exports = {
  search: text => searchApi.search(text).then(filterResults),
};
