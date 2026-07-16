const mammoth = require('mammoth');
const path = require('path');

const wordPath = process.argv[2];

if (!wordPath) {
  console.log('Usage: node read_word.js <path_to_word_document>');
  process.exit(1);
}

mammoth.extractRawText({path: wordPath})
  .then(function(result){
    console.log(result.value);
  })
  .catch(function(err){
    console.error('Error reading document:', err);
  });