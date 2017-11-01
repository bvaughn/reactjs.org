/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * @emails react-core
 */

import Downshift from 'downshift';
import React, {Component} from 'react';
import {urls} from 'site-constants';
import {colors, media} from 'theme';

const SEARCH_DOCUMENTS_PATH = '/search.documents';
const SEARCH_INDEX_PATH = '/search.index';

class DocSearch extends Component {
  state = {
    searchDisabled: false,
    searchInitialized: false,
    searchText: '',
  };

  _searchIndex = null;
  _searchResults = [];

  componentWillUpdate(nextProps, nextState) {
    const {searchInitialized, searchText} = nextState;

    if (searchInitialized && this.state.searchText !== searchText) {
      if (searchText) {
        console.log(searchText);
        this._searchResults = this._searchIndex.search(searchText);
        console.log(this._searchResults);
      } else {
        this._searchResults = [];
      }
    }
  }

  render() {
    const {searchDisabled} = this.state;

    return (
      <form
        css={{
          display: 'flex',
          flex: '0 0 auto',
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: '0.5rem',
          paddingRight: '0.5rem',

          [media.lessThan('small')]: {
            justifyContent: 'flex-end',
          },
          [media.lessThan('large')]: {
            marginRight: 10,
          },
          [media.between('small', 'medium')]: {
            width: 'calc(100% / 3)',
          },
          [media.between('medium', 'xlarge')]: {
            width: 'calc(100% / 6)',
          },
          [media.greaterThan('small')]: {
            minWidth: 120,
          },
        }}>
          <Downshift onChange={this._onChange}>
            {({
              getInputProps,
              getItemProps,
              isOpen,
              inputValue,
              selectedItem,
              highlightedIndex
            }) => [
              <input
                css={{
                  appearance: 'none',
                  background: 'transparent',
                  border: 0,
                  color: searchDisabled ? colors.red : colors.white,
                  opacity: searchDisabled ? 0.5 : 1,
                  fontSize: 18,
                  fontWeight: 300,
                  fontFamily: 'inherit',
                  position: 'relative',
                  padding: '5px 5px 5px 29px',
                  backgroundImage: 'url(/search.svg)',
                  backgroundSize: '16px 16px',
                  backgroundRepeat: 'no-repeat',
                  backgroundPositionY: 'center',
                  backgroundPositionX: '5px',

                  ':focus': {
                    outline: 0,
                    backgroundColor: colors.lighter,
                    borderRadius: '0.25rem',
                  },

                  [media.lessThan('large')]: {
                    fontSize: 16,
                  },
                  [media.greaterThan('small')]: {
                    width: '100%',
                  },
                  [media.lessThan('small')]: {
                    width: '16px',
                    transition: 'width 0.2s ease, padding 0.2s ease',
                    paddingLeft: '16px',

                    ':focus': {
                      paddingLeft: '29px',
                      width: '8rem',
                      outline: 'none',
                    },
                  },
                }}
                {...getInputProps({
                  disabled: searchDisabled,
                  onFocus: this._onFocus,
                  placeholder: 'Search docs',
                  type: 'search',
                })}
              />,
              isOpen ? (
                <div style={{border: '1px solid #ccc'}}>
                  {this._searchResults.map((item, index) => (
                    <div
                      {...getItemProps({item})}
                      key={item}
                      style={{
                        backgroundColor:
                          highlightedIndex === index ? 'gray' : 'white',
                        fontWeight: selectedItem === item ? 'bold' : 'normal',
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : null
            ]
          }
        </Downshift>
      </form>
    );
  }

  // TODO Debounce
  _onChange = event => {
    console.log('_onChange()', event.target.value);
    this.setState({
      searchText: event.target.value,
    });
  };

  _onFocus = () => {
    if (this._searchIndex === null) {
      require.ensure([], () => {
        this._searchIndex = require('./SearchIndex.js');
        window.searcnIndex = this._searchIndex; // TODO TESTING

        this.setState({
          searchInitialized: true,
        });
      });
    }
  };
}

export default DocSearch;
