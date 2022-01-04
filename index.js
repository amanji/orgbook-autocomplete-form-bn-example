'use strict';

// Import stylesheets
import './style.css';
import types from './entity_types';

var fields = {
  _inputs: {},
  get defined() {
    return Object.keys(this._inputs)
      .filter(
        function (k) {
          return this._inputs[k];
        }.bind(this)
      )
      .map(
        function (k) {
          return this._inputs[k];
        }.bind(this)
      );
  },
  set defined(_inputs) {
    this._inputs = _inputs;
  },
  find: function (k) {
    return this._inputs[k];
  },
};

load(); // Simulates a window onload event

function load() {
  fields.defined = {
    name: document.querySelector('#name'),
    type: document.querySelector('#type'),
    registryNumber: document.querySelector('#registryNumber'),
    businessNumber: document.querySelector('#businessNumber'),
  };
  init();
}

function init() {
  try {
    const orgNameInput = fields.find('name');
    if (!orgNameInput) return;
    $(orgNameInput).autocomplete({
      source: function (request, response) {
        $.ajax({
          url: 'https://orgbook.gov.bc.ca/api/v3/search/autocomplete',
          data: {
            q: request.term,
            inactive: 'false',
            revoked: 'false',
            latest: 'true',
          },
          success: function (data) {
            var results = data.total ? data.results : [];
            response(results);
          },
        });
      },
      minLength: 2,
      select: function (event, ui) {
        clearFields();
        getTopic(ui.item);
      },
    });
  } catch (e) {
    console.error('Unable to initialize autocomplete', e);
  }
}

function getTopic(selected) {
  $.ajax({
    url: 'https://orgbook.gov.bc.ca/api/v4/search/topic',
    data: {
      q: selected.topic_source_id,
    },
    beforeSend: function () {
      disableFields();
    },
  })
    .done(function (response) {
      var topic =
        response.total &&
        response.results.find(function (_topic) {
          return _topic.source_id === selected.topic_source_id;
        });
      getTopicCredentials(topic || null);
    })
    .fail(function (e) {
      console.error('Unable to get topic', e);
    })
    .always(function () {
      enableFields();
    });
}

function getTopicCredentials(topic) {
  if (!(topic && topic.id)) return;
  $.ajax({
    url:
      'https://orgbook.gov.bc.ca/api/v4/topic/' + topic.id + '/credential-set',
    beforeSend: function () {
      disableFields();
    },
  })
    .done(function (response) {
      var latestValidCredentials =
        response &&
        response.length &&
        response
          .reduce(function (_latest, _set) {
            return _latest.concat(
              _set.credentials.filter(function (credential) {
                return credential.id === _set.latest_credential_id;
              })
            );
          }, [])
          .filter(function (credential) {
            return !credential.revoked;
          });

      updateFields(topic, latestValidCredentials);
    })
    .fail(function (e) {
      console.error('Unable to get topic credentials', e);
    })
    .always(function () {
      enableFields();
    });
}

function updateFields(topic, credentials) {
  const orgTypeInput = fields.find('type');
  const orgRNInput = fields.find('registryNumber');
  const orgBNInput = fields.find('businessNumber');

  var regCred = credentials.find(function (credential) {
    return (
      credential.credential_type.description === 'registration.registries.ca'
    );
  });

  var bnCred = credentials.find(function (credential) {
    return (
      credential.credential_type.description === 'business_number.registries.ca'
    );
  });

  if (topic && orgRNInput) {
    orgRNInput.value = topic.source_id || '';
  }

  if (regCred && orgRNInput) {
    var orgTypeAttribute = regCred.attributes.find(function (attribute) {
      return attribute.type === 'entity_type';
    });
    orgTypeInput.value = types[orgTypeAttribute.value];
  }

  if (bnCred && orgBNInput) {
    const bnAttr = bnCred.attributes.find(function (attribute) {
      return attribute.type === 'business_number';
    });
    orgBNInput.value = (bnAttr && bnAttr.value) || '';
  }
}

function clearFields() {
  fields.defined.forEach(function (field) {
    field.value = '';
  });
}

function disableFields() {
  fields.defined.forEach(function (field) {
    field.setAttribute('disabled', 'true');
  });
}

function enableFields() {
  fields.defined.forEach(function (field) {
    field.removeAttribute('disabled');
  });
}
