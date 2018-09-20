#!/usr/bin/env node

/*
    Endpoint for client interface with ERC-20 tokens
*/

require( '../db.js' );

var mongoose = require( 'mongoose' );
var Contract = mongoose.model( 'Contract' );
var Transaction = mongoose.model( 'Transaction' );

var eth = require('./web3relay').eth;
var web3 = require('./web3relay').web3;

var BigNumber = require('bignumber.js');
var etherUnits = require(__lib + "etherUnits.js")
var async = require('async');
var abiDecoder = require('abi-decoder');
var filterTrace = require('./filters').filterTrace;

const ABI = [{"constant":false,"inputs":[],"name":"checkGoalReached","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"isTimeUp","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"deadline","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"beneficiary","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"kill","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_addr","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"fundingGoal","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"amountRaised","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"price","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"buy","outputs":[{"name":"amount","type":"uint256"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"},{"name":"_data","type":"bytes"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"},{"name":"_data","type":"bytes"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"return_now","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"safeWithdrawal","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"ifSuccessfulSendTo","type":"address"},{"name":"fundingGoalInEthers","type":"uint256"},{"name":"durationInMinutes","type":"uint256"},{"name":"etherCostOfEachToken","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":false,"name":"recipient","type":"address"},{"indexed":false,"name":"totalAmountRaised","type":"uint256"}],"name":"GoalReached","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"backer","type":"address"},{"indexed":false,"name":"amount","type":"uint256"},{"indexed":false,"name":"isContribution","type":"bool"}],"name":"FundTransfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"},{"indexed":true,"name":"data","type":"bytes"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_owner","type":"address"},{"indexed":true,"name":"_spender","type":"address"},{"indexed":false,"name":"_value","type":"uint256"}],"name":"Approval","type":"event"}];

module.exports = function(req, res){
  console.log(req.body)
  if (!("action" in req.body)) {
    res.status(400).send();
    return;
  }

  var contractAddress = req.body.address.toLowerCase();

  async.waterfall([
    function(callback) {
      // get the creation transaction.
      Transaction.findOne({creates: contractAddress}).lean(true).exec(function(err, doc) {
        if (err || !doc) {
          // no transaction found.
          callback({error: "true", message: "no transaction found"}, null);
          return;
        }
        callback(null, doc);
      });
    },
    function(transaction, callback) {
      Contract.findOne({address: contractAddress}).lean(true)
        .exec(function(err, doc) {
          var contract;
          if (err || !doc) {
            console.log('Contract not found. use default abi.');
            contract = eth.contract(ABI);
          } else {
            try {
              contract = eth.contract(JSON.parse(doc.abi));
            } catch (e) {
              console.log('JSON parse error. use default abi.');
              contract = eth.contract(ABI);
            }
          }
          var token = contract.at(contractAddress);
          callback(null, transaction, contract, token);
        });
    }
  ], function(error, transaction, contract, token) {
    if (error) {
      console.error("Error :", error)
      res.write(JSON.stringify(error));
      res.end();
      return;
    }
  if (req.body.action=="info") {
    var decimals = 0;
    try {
      decimals = token.decimals ? token.decimals() : 0;
    } catch (e) {
      decimals = 0;
    }
    try {
      var actualBalance = eth.getBalance(contractAddress);
      actualBalance = etherUnits.toEther(actualBalance, 'wei');
      var totalSupply = token.totalSupply();
      var name = token.name();
      var symbol = token.symbol();
      var count = eth.getTransactionCount(contractAddress);

      // convert totalSupply unit
      var decimalsBN = new BigNumber(decimals);
      var divisor = new BigNumber(10).pow(decimalsBN);
      totalSupply = totalSupply.dividedBy(divisor);

      var tokenData = {
        "balance": actualBalance,
        "total_supply": totalSupply,
        "count": count,
        "name": name,
        "symbol": symbol,
        "creator": transaction.from,
        "transaction": transaction.hash,
        "timestamp": transaction.timestamp,
        "decimals": decimals,
        "bytecode": eth.getCode(contractAddress)
      }
      res.write(JSON.stringify(tokenData));
      res.end();
    } catch (e) {
      console.error(e);
    }
  } else if (req.body.action=="balanceOf") {
    var addr = req.body.user.toLowerCase();
    var decimals = 0;
    try {
      decimals = token.decimals ? token.decimals() : 0;
    } catch (e) {
      decimals = 0;
    }
    try {
      var tokens = token.balanceOf(addr);
      var decimalsBN = new BigNumber(decimals);
      var divisor = new BigNumber(10).pow(decimalsBN);
      tokens = tokens.dividedBy(divisor);
      res.write(JSON.stringify({"tokens": tokens}));
      res.end();
    } catch (e) {
      var tokens = token.balanceOf(addr);
      var decimalsBN = new BigNumber(decimals);
      var divisor = new BigNumber(10).pow(decimalsBN);
      tokens = tokens.dividedBy(divisor);
      res.write(JSON.stringify({"tokens": tokens}));
      res.end();
    }
  } else if (req.body.action == "transfer") {
    var after = 0;
    if (req.body.after) {
      after = parseInt(req.body.after);
      if (after < 0) {
        after = 0;
      }
    }

    var addr = req.body.address.toLowerCase();
    abiDecoder.addABI(contract.abi);

    // convert token unit
    var decimals = 0;
    try {
      decimals = token.decimals ? token.decimals() : 0;
    } catch (e) {
      decimals = 0;
    }
    var decimalsBN = new BigNumber(decimals);
    var divisor = new BigNumber(10).pow(decimalsBN);

    var fromBlock = transaction.blockNumber;
    fromBlock = web3.toHex(fromBlock);
    var filter = {"fromBlock": fromBlock, "toAddress":[addr]};
    filter.count = MAX_ENTRIES;
    if (after) {
      filter.after = after;
    }
    web3.trace.filter(filter, function(err, tx) {
      if(err || !tx) {
        console.error("TraceWeb3 error :" + err)
        res.write(JSON.stringify({"error": true}));
      } else {
        var txns = filterTrace(tx);
        var transfers = [];
        txns.forEach(function(t) {
          if (t.type == "call") {
            var callInfo = abiDecoder.decodeMethod(t.action.input);
            if (callInfo && callInfo.name && callInfo.name == 'transfer') {
              // convert amount
              var amount = new BigNumber(callInfo.params[1].value);
              t.amount = amount.dividedBy(divisor);
              // replace to address with _to address arg
              t.to = callInfo.params[0].value;
              t.callInfo = callInfo;
              transfers.push(t);
            }
          }
        });
        res.write(JSON.stringify({transfer:transfers, after:after, count:filter.count}));
      }
      res.end();
    })
  } else if (req.body.action == "transaction") {
    var addr = req.body.address.toLowerCase();

    var after = 0;
    if (req.body.after) {
      after = parseInt(req.body.after);
      if (after < 0) {
        after = 0;
      }
    }

    abiDecoder.addABI(contract.abi);

    var decimals = 0;
    try {
      decimals = token.decimals ? token.decimals() : 0;
    } catch (e) {
      decimals = 0;
    }
    var divisor = new BigNumber(10).pow(decimals);

    var fromBlock = transaction.blockNumber;
    fromBlock = web3.toHex(fromBlock);
    var filter = {"fromBlock": fromBlock, "toAddress":[addr]};
    filter.count = MAX_ENTRIES;
    if (after) {
      filter.after = after;
    }

    web3.trace.filter(filter, function(err, tx) {
      if(err || !tx) {
        console.error("TraceWeb3 error :" + err)
        res.write(JSON.stringify({"error": true}));
      } else {
        var txns = filterTrace(tx);
        txns = txns.map(function(t) {
          if (t.type == "call") {
            var callInfo = abiDecoder.decodeMethod(t.action.input);
            if (callInfo && callInfo.name && callInfo.name == 'transfer') {
              // convert amount
              var amount = new BigNumber(callInfo.params[1].value);
              t.amount = amount.dividedBy(divisor).toString(10);
              // replace to address with _to address arg
              t.to = callInfo.params[0].value;
              t.type = 'transfer';
            }
            t.callInfo = callInfo;
          }
          return t;
        });
        res.write(JSON.stringify({transaction:txns, after: after, count: filter.count}));
      }
      res.end();
    })

  }
  });
  
};  

const MAX_ENTRIES = 20;