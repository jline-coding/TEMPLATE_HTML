var requiredColor = {
	required: '#F00',
	ok: '#FFF',
	focus: '#FFF'
};
mfp.extend.event('init',
	function(obj){
		if(mfp.Elements[obj.name].required){
			if(mfp.Elements[obj.name].type == "text" || mfp.Elements[obj.name].type == "textarea" || mfp.Elements[obj.name].type == "email" || mfp.Elements[obj.name].type == "tel" || mfp.Elements[obj.name].type == "number"){
				obj.style.backgroundColor = requiredColor.required;
			};
		};
	}
);
mfp.extend.event('focus',
	function(obj){
		if(mfp.Elements[obj.name].required){
			if(mfp.Elements[obj.name].type == "text" || mfp.Elements[obj.name].type == "textarea" || mfp.Elements[obj.name].type == "email" || mfp.Elements[obj.name].type == "tel" || mfp.Elements[obj.name].type == "number"){
				obj.style.backgroundColor = requiredColor.focus;
			};
		};
	}
);
mfp.extend.event('blur',
	function(obj){
		if(mfp.Elements[obj.name].required){
			if(mfp.Elements[obj.name].type == "text" || mfp.Elements[obj.name].type == "textarea" || mfp.Elements[obj.name].type == "email" || mfp.Elements[obj.name].type == "tel" || mfp.Elements[obj.name].type == "number"){
				if(mfp.check(obj)){
					obj.style.backgroundColor = requiredColor.required;
				}
				else {
					obj.style.backgroundColor = requiredColor.ok;
				};
			};
		};
	}
);
