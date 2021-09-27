#!/bin/bash      
set -ex
 subs=$(az account management-group show --name $MANAGEMENT_GROUP --expand --query "children [?type=='/subscriptions'].id" -o tsv)

        subs="${subs//$'\n'/'%0A'}"
        echo ::set-output name=subs::"$subs"
        
        subs=$(az account management-group show --name $MANAGEMENT_GROUP --expand --query "children [?type=='/subscriptions'].id" -o tsv)
        for sub in $subs; do
          sub_id=$(echo $sub | cut -d "/" -f 3 )
          if [[ $(az account show --subscription $sub_id --query state -o tsv) == "Enabled" ]] ; then 
            echo $sub >> subs.txt 
          fi
        done
        
        echo "Enabled Subs"
        cat subs.txt
        
        # Have to escape new lines to get all lines of a multiline var
        # https://github.community/t/set-output-truncates-multiline-strings/16852/3
        enabled_subs=$(cat subs.txt)
        enabled_subs="${enabled_subs//$'\n'/'%0A'}"
        echo ::set-output name=subs::"$enabled_subs"
        
