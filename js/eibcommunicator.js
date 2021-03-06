var _EventCanUse = false;
if(typeof(EventSource)!=="undefined")
{
  _EventCanUse = true;
} else {
  _EventCanUse = false;
}

// EIBCommunicator
var EIBCommunicator = {
	listeners: new Object(),
	polling: false,
  stoppolling: false,
  date_stop_polling: null,

	add: function(o) {
		var l=o.getListeningObject();
		for(var i=0;i<l.length; i++)
			if (l[i]) {
				if (!EIBCommunicator.listeners[l[i]]) EIBCommunicator.listeners[l[i]]=Array();
				EIBCommunicator.listeners[l[i]].push(o);
			}
	},
	remove: function(o) {
		for(key in EIBCommunicator.listeners) {
			for (var i=0;i<EIBCommunicator.listeners[key].length; i++) {
				if (EIBCommunicator.listeners[key][i]==o) EIBCommunicator.listeners[key].splice(i,1);
			}
			if (EIBCommunicator.listeners[key].length==0) delete EIBCommunicator.listeners[key];
		}
	},
	refreshListeningObject: function(o) {
		EIBCommunicator.remove(o);
		EIBCommunicator.add(o);
	},
	eibWrite: function(obj,value, successCallBack) {
		if (!obj)
			return;
    var responseXML = queryLinknx("<write><object id='"+obj+"' value='"+value+"'/></write>");
    if (responseXML) {
      EIBCommunicator.sendUpdate(obj, value);
			if (successCallBack) successCallBack(responseXML);
    }
	},
	sendUpdate: function(obj,value) {
		var listeners = EIBCommunicator.listeners[obj];
		if (listeners) {
			for (var i=0;i<listeners.length; i++)
				listeners[i].updateObject(obj,value);
		}
	},
	eibRead: function(objects,completeCallBack) {
		if (objects.length > 0) {
			var body = '<read><objects>';
			for (var i=0; i < objects.length; i++)
				if (objects[i] && objects[i] != "null")
					body += "<object id='" + objects[i] + "'/>";
			body += "</objects></read>";

      var xmlResponse = queryLinknx(body);
      if (xmlResponse) {
						// Send update to subscribers
						var objs = xmlResponse.getElementsByTagName('object');
						if (objs.length == 0)
								EIBCommunicator.sendUpdate(objects, xmlResponse.childNodes[0].nodeValue);
						else {
							for (var i=0; i < objs.length; i++) {
								var element = objs[i];
								EIBCommunicator.sendUpdate(element.getAttribute('id'),element.getAttribute('value'));
							}
						}
        if (completeCallBack) completeCallBack();
			}
		}
		else if (completeCallBack)
		    completeCallBack();
	},
	executeActionList: function(actionsList) {
		//var actions=actionsList.get(0).childNodes;
    var actions=actionsList.get(0);
		if (actions.childNodes.length>0) {
  		var xml='<execute>';
  		for(var i=0; i<actions.childNodes.length; i++)
  		{
  			var action=actions.childNodes[i]; //var action=actions[i];
  			// Already dispatch new value if type == set-value
  			//if (action.getAttribute('type')=='set-value') EIBCommunicator.sendUpdate(action.getAttribute('id'), action.getAttribute('value'));
  			if (action.nodeType == 1 && action.getAttribute('type')=='set-value') EIBCommunicator.sendUpdate(action.getAttribute('id'), action.getAttribute('value'));
  			xml+=serializeXmlToString(actions.childNodes.item(i));//xml+=serializeXmlToString(actions[i]);
  		}
  		xml+='</execute>';
  		EIBCommunicator.query(xml);
  	}
	},
	query: function(body, successCallBack) {

    var responseXML = queryLinknx(body);
    if (responseXML) {
      if (successCallBack) successCallBack(responseXML);
		}
	},
	updateAll: function(completeCallBack) {
		var obj = new Array();
		for(key in EIBCommunicator.listeners)
			obj.push(key);
		EIBCommunicator.eibRead(obj, completeCallBack);
	},
	periodicUpdate: function() {
    EIBCommunicator.polling = true;
    if (EIBCommunicator.stoppolling) return;
		EIBCommunicator.updateAll(function(XMLHttpRequest, textStatus) {
				setTimeout('EIBCommunicator.periodicUpdate()', 1000);
			});
	},
	runUpdate: function() {
    if (_EventCanUse && tab_config.useEventSource=='true') {
      // Update all object at the beginning, after linknx only send "notify" of objects changed
      EIBCommunicator.updateAll();
      var source=new EventSource("event_linknx.php");
      source.onmessage=function(event)
      {
        var xmlResponse = StringtoXML(event.data).documentElement; // Convert the data in xml
        /*if (xmlResponse.getAttribute('status') == 'error') { // retour de l'enregistrement de "notification"
          UIController.setNotification(tr("Error: ")+xmlResponse.textContent);
        } else if (xmlResponse.getAttribute('status') == 'success') {  // retour de l'enregistrement de "notification"
          UIController.setNotification(tr("Success: ")+xmlResponse.textContent);
        } else */
        if (xmlResponse.getAttribute('id') && xmlResponse.nodeName == "notify") {
          //console.log("EventSource update object id=", xmlResponse.getAttribute('id'), "value=", xmlResponse.childNodes[0].nodeValue);
          EIBCommunicator.sendUpdate(xmlResponse.getAttribute('id'), xmlResponse.childNodes[0].nodeValue);
        }
      }
    } else {
      if (tab_config.useJavaIfAvailable=='true')
  		{
  			if (navigator.javaEnabled())
  			{
  				// Update all object
  				EIBCommunicator.updateAll();
  			} else EIBCommunicator.periodicUpdate();
  		} else EIBCommunicator.periodicUpdate();
    }
	},
	removeAll: function() {
		for(key in EIBCommunicator.listeners)
			delete EIBCommunicator.listeners[key];
	}
}
