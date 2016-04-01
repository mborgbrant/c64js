'use strict';

var gulp = require('gulp');
var useref = require('gulp-useref');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var cleanCss = require('gulp-clean-css');
var clean = require('gulp-clean');

gulp.task('clean', function() {
	return gulp.src('dist', {read: false})
		.pipe(clean());
})

gulp.task('compress', ['clean'], function() {
	return gulp.src('src/index.html')
		.pipe(useref())
		.pipe(gulpif('*.js', uglify({
			mangle: {toplevel: false},
			compress: {
				sequences: true,
				dead_code: true,
				conditionals: true,
				booleans: true,
				unused: true,
				if_return: true,
				join_vars: true,
				drop_console: true
			}})))
		.pipe(gulpif('*.css', cleanCss({keepSpecialComments: false})))
		.pipe(gulp.dest('dist'));
});

gulp.task('copy', ['compress'], function() {
	return gulp.src('src/fonts/**').pipe(gulp.dest('dist/fonts'));
});

gulp.task('default', ['clean', 'compress', 'copy']);