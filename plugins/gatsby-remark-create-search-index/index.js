const visit = require('unist-util-visit');

module.exports = ({markdownAST}) => {
  visit(markdownAST, `text`, node => {
    const text = node.value.trim();

    if (text === '') {
      return;
    }

    //console.log(node);
  });
};
