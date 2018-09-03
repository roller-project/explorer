angular.module('BlocksApp').controller('AccountsController', function($stateParams, $rootScope, $scope, $http, $filter) {
  $scope.settings = $rootScope.setup;

  // fetch accounts
  var getAccounts = function() {
    $("#table_accounts").DataTable({
      processing: true,
      serverSide: true,
      paging: true,
      ajax: function(data, callback, settings) {
        // get totalSupply only once.
        data.totalSupply = $scope.totalSupply || -1;
        data.recordsTotal = $scope.totalAccounts || 0;
        $http.post('/richlist', data).then(function(resp) {
          // set the totalSupply
          if (resp.data.totalSupply) {
            $scope.totalSupply = resp.data.totalSupply;
          }
          // set the number of total accounts
          $scope.totalAccounts = resp.data.recordsTotal;

          // fixup data to show percentages
          var newdata = resp.data.data.map(function(item) {
            return [item[0], item[1], item[2], item[3], (item[3] / $scope.totalSupply) * 100, item[4]];
          });
          resp.data.data = newdata;
          callback(resp.data);
        });
      },
      lengthMenu: [
        [20, 50, 100, 150, 200, 500],
        [20, 50, 100, 150, 200, 500] // change per page values here
      ],
      pageLength: 20,
      order: [
        [3, "desc"]
      ],
      language: {
        lengthMenu: "_MENU_ accounts",
        zeroRecords: "No accounts found",
        infoEmpty: "",
        infoFiltered: "(filtered from _MAX_ total accounts)"
      },
      columnDefs: [
        { orderable: false, "targets": [0,1,2,4] },
        {
          render:
            function(data, type, row) {
              return '<a href="/addr/' + data +'">' + data.replace('0xf5e48e9cb2fabdf4ce157f23a56f6665e478ec6f','Masternode Contracts').replace('0x672af8a93fab9135d60ba69218d0d6ce570fa0e4','Miner block 0-50.000').replace('0xf1fd34b7a4d3af6b4a8f6ff7d4c3d982fd5dd6af','Masternode Base') + '</a>'
            },
          targets: [1]
        },
        {
          render:
            function(data, type, row) {
              return $filter('number')(data, 8);
            },
          targets: [3]
        },
        {
          render:
            function(data, type, row) {
              return $filter('number')(data, 4) + ' %';
            },
          targets: [4]
        }
      ]
    });
  };

  getAccounts();
});
