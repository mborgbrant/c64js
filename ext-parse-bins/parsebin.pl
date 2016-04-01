#!/usr/bin/perl

use strict;
use warnings;

if ($#ARGV + 1 != 3) {
   die "\narguments: infile outfile variableName\n\n";
}

open(my $in,  "<",  $ARGV[0])  or die "Can't open input.txt: $!";
open(my $out, ">",  $ARGV[1]) or die "Can't open output.txt: $!";

binmode($in);

my @bytes = ();

$/ = \1;

while (<$in>) {
    push(@bytes, "0x".sprintf("%02x", ord($_)));
 }

my $js = join(', ', @bytes);

my $n = 16;
my $s = 0;
sub resetLine {
    $n = 16;
    $s += 16;
    return ",\n\t/* 0x".sprintf("%04x", $s)." */\t";
}

my $nn=16;
my $ss=16;
sub newLine {
    $nn = 16;
    return "\n\n";
}

my $jw = $js;
$js =~ s/(, )/!--$n ? resetLine() : $1/ge;
$js =~ s/(\n)/!--$nn ? newLine() : $1/ge;

print $out "var $ARGV[2] = [\n";
print $out "\t\t\t\t /* 0x00  0x01  0x02  0x03  0x04  0x05  0x06  0x07  0x08  0x09  0x0a  0x0b  0x0c  0x0d  0x0e  0x0f */\n";
print $out "\t/* 0x0000 */\t$js\n";
print $out "];";

close $out;
close $in;