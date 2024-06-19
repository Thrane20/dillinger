#!/bin/bash
cd ..
for i in */ .*/ ; do 
    echo -n "$i: " ; 
    num_files=$(find "$i" -type f | wc -l) 
    total_size=$(find "$i" -type f -exec du -ch {} + | grep total$ | awk '{print $1}')
    echo "$num_files files, $total_size"
done